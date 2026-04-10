import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { adicionarNaFila } from '@/lib/filas/queue'
import { normalizarCnpj, validarCnpj } from '@/lib/utils'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'
export const maxDuration = 60  // máximo Vercel Hobby

/**
 * Detecta o período do valor com base no nome da coluna e retorna o divisor
 * para converter em valor mensal.
 *
 * Regras de nome (contém):
 *   mensal / mes / mês / monthly / month  → ÷ 1
 *   trimestral / trimestre / quarterly    → ÷ 3
 *   semestral / semestre                  → ÷ 6
 *   anual / ano / annual / year / total   → ÷ 12
 *   genérico (valor / compra)             → ÷ 1 (assume mensal)
 */
function detectarPeriodoColuna(nomeColuna: string): { divisor: number; periodo: string } {
  const c = nomeColuna.toLowerCase()

  if (/mensal|m[eê]s|monthly|month/.test(c)) {
    return { divisor: 1, periodo: 'mensal' }
  }
  if (/trimestral|trimestre|quarterly|quarter/.test(c)) {
    return { divisor: 3, periodo: 'trimestral' }
  }
  if (/semestral|semestre/.test(c)) {
    return { divisor: 6, periodo: 'semestral' }
  }
  if (/anual|ano\b|annual|year|total/.test(c)) {
    return { divisor: 12, periodo: 'anual' }
  }

  // Genérico — trata como mensal
  return { divisor: 1, periodo: 'mensal (assumido)' }
}

/**
 * Converte string de valor monetário para número float.
 * Suporta:
 *   - Formato brasileiro: 1.200,50 → 1200.50
 *   - Formato americano:  1,200.50 → 1200.50
 *   - Sem decimal:        1200     → 1200.00
 *   - Com R$:             R$ 1.200,50 → 1200.50
 */
function parsearValor(raw: string): number {
  const limpo = raw.trim().replace(/R\$\s*/i, '').replace(/\s/g, '')

  if (!limpo) return 0

  const temVirgula = limpo.includes(',')
  const temPonto = limpo.includes('.')

  if (temVirgula && temPonto) {
    // Tem os dois separadores — o último é o decimal
    if (limpo.lastIndexOf(',') > limpo.lastIndexOf('.')) {
      // Formato BR: 1.200,50
      return parseFloat(limpo.replace(/\./g, '').replace(',', '.')) || 0
    } else {
      // Formato US: 1,200.50
      return parseFloat(limpo.replace(/,/g, '')) || 0
    }
  }

  if (temVirgula) {
    const partes = limpo.split(',')
    if (partes.length === 2 && partes[1].length <= 2) {
      // Vírgula decimal: 1200,50
      return parseFloat(limpo.replace(',', '.')) || 0
    }
    // Vírgula como milhar: 1,200
    return parseFloat(limpo.replace(/,/g, '')) || 0
  }

  if (temPonto) {
    const partes = limpo.split('.')
    if (partes.length === 2 && partes[1].length <= 2) {
      // Ponto decimal: 1200.50
      return parseFloat(limpo) || 0
    }
    // Ponto como milhar: 1.200
    return parseFloat(limpo.replace(/\./g, '')) || 0
  }

  return parseFloat(limpo) || 0
}

export async function POST(req: NextRequest) {
  try {
    return await _handlePost(req)
  } catch (err) {
    console.error('[importar] erro não tratado:', err)
    return NextResponse.json({ error: `Erro interno: ${String(err)}` }, { status: 500 })
  }
}

async function _handlePost(req: NextRequest) {
  let userId: string | null = null
  let orgId: string | null = null
  try {
    const authResult = await auth()
    userId = authResult.userId
    orgId = authResult.orgId ?? null
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })

  if (!empresa) {
    return NextResponse.json({ error: 'Empresa não cadastrada' }, { status: 404 })
  }

  const formData = await req.formData()
  const arquivo = formData.get('arquivo') as File | null

  if (!arquivo) {
    return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
  if (arquivo.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Limite: 50 MB.' }, { status: 413 })
  }

  const buffer = await arquivo.arrayBuffer()
  const nomeArquivo = arquivo.name.toLowerCase()

  // Detectar tipo e fazer parse
  let linhas: Record<string, string>[] = []

  if (nomeArquivo.endsWith('.csv')) {
    // Remove BOM se presente e normaliza quebras de linha
    let texto = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '')
    // Detecta separador: se a primeira linha contém ';' mas não ',', usa ponto-e-vírgula
    const primeiraLinha = texto.split(/\r?\n/)[0] ?? ''
    const separador = primeiraLinha.includes(';') && !primeiraLinha.includes(',') ? ';' : ','
    const resultado = Papa.parse<Record<string, string>>(texto, {
      header: true,
      skipEmptyLines: true,
      delimiter: separador,
      transformHeader: (h) => h.trim(),
    })
    linhas = resultado.data
  } else if (nomeArquivo.endsWith('.xlsx') || nomeArquivo.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const primeiraSheet = workbook.Sheets[workbook.SheetNames[0]]
    linhas = XLSX.utils.sheet_to_json<Record<string, string>>(primeiraSheet, {
      defval: '',
    })
  } else {
    return NextResponse.json(
      { error: 'Formato inválido. Envie CSV ou XLSX.' },
      { status: 400 }
    )
  }

  if (linhas.length === 0) {
    return NextResponse.json({ error: 'Arquivo vazio ou sem dados.' }, { status: 400 })
  }

  // Detectar colunas automaticamente
  const colunas = Object.keys(linhas[0] ?? {})

  const colunaCnpj = colunas.find(
    (c) => c.toLowerCase().includes('cnpj') || c.toLowerCase().includes('cpf_cnpj')
  )
  // Detecta a coluna de valor E já extrai o período pelo nome dela
  const colunaValor = colunas.find(
    (c) =>
      c.toLowerCase().includes('valor') ||
      c.toLowerCase().includes('compra') ||
      c.toLowerCase().includes('total') ||
      c.toLowerCase().includes('mensal') ||
      c.toLowerCase().includes('trimestral') ||
      c.toLowerCase().includes('semestral') ||
      c.toLowerCase().includes('anual')
  )
  const colunaNome = colunas.find(
    (c) =>
      c.toLowerCase().includes('nome') ||
      c.toLowerCase().includes('razao') ||
      c.toLowerCase().includes('fornecedor')
  )

  if (!colunaCnpj) {
    return NextResponse.json(
      { error: 'Coluna CNPJ não encontrada. Inclua uma coluna com "cnpj" no cabeçalho.' },
      { status: 400 }
    )
  }

  // Detectar período do valor (mensal/trimestral/semestral/anual)
  const { divisor: divisorPeriodo, periodo: periodoDetectado } = colunaValor
    ? detectarPeriodoColuna(colunaValor)
    : { divisor: 1, periodo: 'não informado' }

  // --- Fase 1: validar todas as linhas e separar as inválidas ---
  const cnpjsInvalidos: string[] = []
  const linhasValidas: Array<{
    cnpj: string
    nomeErp: string | undefined
    valorMedioComprasMensal: string | undefined
  }> = []

  for (const linha of linhas) {
    const cnpjRaw = String(linha[colunaCnpj] ?? '').trim()
    const cnpj = normalizarCnpj(cnpjRaw)

    if (!cnpj || !validarCnpj(cnpj)) {
      cnpjsInvalidos.push(cnpjRaw || '(vazio)')
      continue
    }

    const nomeErpRaw = colunaNome ? String(linha[colunaNome] ?? '').trim() : ''
    // Remove null bytes, controle e surrogados Unicode inválidos (causam falha no JSON/PostgreSQL)
    const nomeErp = nomeErpRaw
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // controle ASCII
      .replace(/[\uD800-\uDFFF]/g, '')                       // surrogados UTF-16 isolados
      .replace(/\uFFFD/g, '')                                // replacement character
      .slice(0, 500) || undefined

    let valorMensal: number | undefined
    if (colunaValor) {
      const valorBruto = parsearValor(String(linha[colunaValor] ?? ''))
      if (valorBruto > 0 && isFinite(valorBruto)) {
        valorMensal = valorBruto / divisorPeriodo
      }
    }

    linhasValidas.push({
      cnpj,
      nomeErp,
      valorMedioComprasMensal: valorMensal !== undefined ? String(valorMensal) : undefined,
    })
  }

  const erros = cnpjsInvalidos.length

  // --- Fase 2: batch insert em lotes de 500 ---
  const LOTE = 500
  let inseridos = 0
  let duplicatas = 0
  const jobsParaFila: Array<{ cnpj: string; fornecedorId: string; empresaId: string }> = []

  for (let i = 0; i < linhasValidas.length; i += LOTE) {
    const lote = linhasValidas.slice(i, i + LOTE)
    try {
      const inseridos_rows = await db
        .insert(fornecedores)
        .values(
          lote.map((r) => ({
            empresaId: empresa.id,
            cnpj: r.cnpj,
            nomeErp: r.nomeErp,
            valorMedioComprasMensal: r.valorMedioComprasMensal,
            statusEnriquecimento: 'pendente' as const,
          }))
        )
        .onConflictDoNothing({ target: [fornecedores.cnpj, fornecedores.empresaId] })
        .returning({ id: fornecedores.id, cnpj: fornecedores.cnpj })

      inseridos += inseridos_rows.length
      duplicatas += lote.length - inseridos_rows.length

      for (const row of inseridos_rows) {
        jobsParaFila.push({ cnpj: row.cnpj, fornecedorId: row.id, empresaId: empresa.id })
      }
    } catch (errLote) {
      console.error(`[importar] erro no lote ${i}-${i + lote.length}:`, errLote)
      // lote falhou — tenta linha a linha para recuperar o máximo
      for (const r of lote) {
        try {
          const [novo] = await db
            .insert(fornecedores)
            .values({
              empresaId: empresa.id,
              cnpj: r.cnpj,
              nomeErp: r.nomeErp,
              valorMedioComprasMensal: r.valorMedioComprasMensal,
              statusEnriquecimento: 'pendente' as const,
            })
            .onConflictDoNothing({ target: [fornecedores.cnpj, fornecedores.empresaId] })
            .returning({ id: fornecedores.id })
          if (novo) {
            inseridos++
            jobsParaFila.push({ cnpj: r.cnpj, fornecedorId: novo.id, empresaId: empresa.id })
          } else {
            duplicatas++
          }
        } catch {
          // Fallback 2: inserir só CNPJ sem campos opcionais (encoding problemático no nome/valor)
          try {
            const [novo2] = await db
              .insert(fornecedores)
              .values({
                empresaId: empresa.id,
                cnpj: r.cnpj,
                statusEnriquecimento: 'pendente' as const,
              })
              .onConflictDoNothing({ target: [fornecedores.cnpj, fornecedores.empresaId] })
              .returning({ id: fornecedores.id })
            if (novo2) {
              inseridos++
              jobsParaFila.push({ cnpj: r.cnpj, fornecedorId: novo2.id, empresaId: empresa.id })
            } else {
              duplicatas++
            }
          } catch (e3) {
            console.error('[importar] falha total ao inserir CNPJ:', r.cnpj, String(e3))
            cnpjsInvalidos.push(r.cnpj)
          }
        }
      }
    }
  }

  // --- Fase 3: enfileirar enriquecimento em bulk (Redis isolado — falha não cancela importação) ---
  let filaErro: string | null = null
  if (jobsParaFila.length > 0) {
    try {
      await adicionarNaFila(jobsParaFila)
    } catch (errFila) {
      filaErro = String(errFila)
      console.error('[importar] erro ao enfileirar enriquecimento (Redis):', errFila)
      // Importação já foi salva no banco — enriquecimento pode ser disparado manualmente
    }
  }

  return NextResponse.json({
    total: linhas.length,
    inseridos,
    duplicatas,
    erros: cnpjsInvalidos.length,
    cnpjsInvalidos: cnpjsInvalidos.slice(0, 50),
    periodoDetectado,
    colunaValorDetectada: colunaValor ?? null,
    avisoFila: filaErro ? 'Fornecedores salvos, mas fila de enriquecimento falhou. Clique "Enriquecer tudo" na tela de Fornecedores.' : null,
  })
}
