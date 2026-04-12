import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
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
      // Ponto decimal claro: "1200.50"
      return parseFloat(limpo) || 0
    }
    if (partes.length === 2 && partes[1].length > 3) {
      // Imprecisão IEEE 754 do XLSX/JavaScript: "12964369.740000004"
      // O Excel armazena 12964369.74 mas JS converte para string com ruído de float.
      // O ponto É o separador decimal — arredondamos para 2 casas para eliminar o ruído.
      return Math.round(parseFloat(limpo) * 100) / 100 || 0
    }
    // Ponto como milhar brasileiro (exatamente 3 dígitos após o ponto): "1.200" → 1200
    return parseFloat(limpo.replace(/\./g, '')) || 0
  }

  return parseFloat(limpo) || 0
}

export async function POST(req: NextRequest) {
  try {
    return await _handlePost(req)
  } catch (err) {
    console.error('[importar] erro não tratado:', err)
    return NextResponse.json({ error: 'Erro interno ao processar arquivo. Tente novamente.' }, { status: 500 })
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
  const periodoManual = (formData.get('periodo') as string | null)?.toLowerCase() ?? 'auto'
  // Coluna de valor manual: se informada, substitui a auto-detecção
  const colunaValorManual = (formData.get('colunaValor') as string | null)?.trim() || null
  // Coluna de plano de contas / categoria: opcional
  const colunaCategoriaManual = (formData.get('colunaCategoria') as string | null)?.trim() || null

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

  const MAX_LINHAS = 15000
  if (linhas.length > MAX_LINHAS) {
    return NextResponse.json(
      { error: `Arquivo com muitas linhas (${linhas.length}). Máximo: ${MAX_LINHAS} linhas por importação.` },
      { status: 413 }
    )
  }

  // Detectar colunas automaticamente
  const colunas = Object.keys(linhas[0] ?? {})

  // Coluna nomeada apenas "cpf" (sem "cnpj") → planilha de pessoas físicas, nada a importar
  const colunaApenasCpf = colunas.find(
    (c) => /^cpf$/i.test(c.trim())
  )

  const colunaCnpj = colunas.find(
    (c) => c.toLowerCase().includes('cnpj') || c.toLowerCase().includes('cpf_cnpj')
  )

  // Coluna de valor: usa a informada manualmente (se existir no arquivo) ou auto-detecta
  const colunaValor =
    (colunaValorManual && colunas.includes(colunaValorManual) ? colunaValorManual : null) ??
    colunas.find(
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

  // Coluna de plano de contas / categoria de gasto
  const colunaCategoria =
    (colunaCategoriaManual && colunas.includes(colunaCategoriaManual) ? colunaCategoriaManual : null) ??
    colunas.find((c) =>
      /plano|categoria|fluxo|conta\b|tipo.?gasto|classificac/i.test(c)
    )

  if (!colunaCnpj) {
    if (colunaApenasCpf) {
      // Planilha só com CPF — retorna aviso sem erro, nada inserido
      return NextResponse.json({
        total: linhas.length,
        inseridos: 0,
        duplicatas: 0,
        pessoasFisicas: linhas.length,
        erros: 0,
        cnpjsInvalidos: [],
        periodoDetectado: 'não informado',
        colunaValorDetectada: null,
        avisoFila: null,
        avisoCpf: `Planilha contém apenas a coluna "cpf" — pessoas físicas não são importadas (sem CNPJ, sem crédito de CBS/IBS). Nenhum dado foi armazenado.`,
      })
    }
    return NextResponse.json(
      { error: 'Coluna CNPJ não encontrada. Inclua uma coluna com "cnpj" no cabeçalho.' },
      { status: 400 }
    )
  }

  // Período: usa seleção manual do usuário ou detecta automaticamente pelo nome da coluna
  const DIVISORES_MANUAIS: Record<string, { divisor: number; periodo: string }> = {
    mensal:      { divisor: 1,  periodo: 'mensal (selecionado)' },
    trimestral:  { divisor: 3,  periodo: 'trimestral (selecionado)' },
    semestral:   { divisor: 6,  periodo: 'semestral (selecionado)' },
    anual:       { divisor: 12, periodo: 'anual (selecionado)' },
  }
  const { divisor: divisorPeriodo, periodo: periodoDetectado } =
    periodoManual !== 'auto' && DIVISORES_MANUAIS[periodoManual]
      ? DIVISORES_MANUAIS[periodoManual]
      : colunaValor
        ? detectarPeriodoColuna(colunaValor)
        : { divisor: 1, periodo: 'não informado' }

  // --- Fase 1: validar todas as linhas e separar por tipo ---
  const cnpjsInvalidos: string[] = []
  const linhasValidas: Array<{
    cnpj: string
    nomeErp: string | undefined
    valorMedioComprasMensal: string | undefined
    valorRaw: string  // diagnóstico: valor bruto da célula
    categoriaCompra: string | undefined
  }> = []
  const pessoasFisicas: Array<{
    pfCnpj: string          // chave determinística 14 chars para dedup
    nomeErp: string | undefined
    valorMedioComprasMensal: string | undefined
    categoriaCompra: string | undefined
  }> = []
  let semValorCnpj = 0 // CNPJs válidos sem valor ou com valor zero/inválido

  for (const linha of linhas) {
    const cnpjRaw = String(linha[colunaCnpj] ?? '').trim()
    const digits = cnpjRaw.replace(/\D/g, '')

    // Extrair nome e valor (comum a CNPJ e CPF)
    const nomeErpRaw = colunaNome ? String(linha[colunaNome] ?? '').trim() : ''
    // Remove null bytes, controle e surrogados Unicode inválidos (causam falha no JSON/PostgreSQL)
    const nomeErp = nomeErpRaw
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // controle ASCII
      .replace(/[\uD800-\uDFFF]/g, '')                       // surrogados UTF-16 isolados
      .replace(/\uFFFD/g, '')                                // replacement character
      .slice(0, 500) || undefined

    const valorRaw = colunaValor ? String(linha[colunaValor] ?? '').trim() : ''
    let valorMensal: number | undefined
    if (colunaValor) {
      const valorBruto = parsearValor(valorRaw)
      if (valorBruto > 0 && isFinite(valorBruto)) {
        valorMensal = valorBruto / divisorPeriodo
      }
    }
    const valorMensalStr = valorMensal !== undefined ? String(valorMensal) : undefined

    // Pessoa física: coluna contém "CPF" (texto), CPF com 11 dígitos, ou célula vazia
    const isCpfText = /^cpf$/i.test(cnpjRaw)
    const isCpfNumero = digits.length === 11
    const isPessoaFisica = isCpfText || isCpfNumero || cnpjRaw === '' || digits === ''
    if (isPessoaFisica) {
      // ID determinístico de exatamente 14 chars (limite da coluna cnpj varchar(14)):
      //   CPF número → "CPF" + 11 dígitos = 14 chars
      //   CPF texto / nome → "PF" + 12 chars do nome normalizado (pad com '0' se curto)
      //   sem nome → "PF" + 12 primeiros chars de um UUID hex
      let pfCnpj: string
      if (isCpfNumero) {
        pfCnpj = `CPF${digits}` // "CPF" + 11 dígitos = 14 chars
      } else if (nomeErp) {
        const nomeKey = nomeErp.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12).padEnd(12, '0')
        pfCnpj = `PF${nomeKey}` // "PF" + 12 chars = 14 chars
      } else {
        pfCnpj = `PF${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
      }
      const categoriaPF = colunaCategoria
        ? String(linha[colunaCategoria] ?? '').trim().slice(0, 200) || undefined
        : undefined
      pessoasFisicas.push({ pfCnpj, nomeErp, valorMedioComprasMensal: valorMensalStr, categoriaCompra: categoriaPF })
      continue
    }

    // CNPJ — normalizar e validar
    const cnpj = normalizarCnpj(cnpjRaw)
    if (!cnpj || !validarCnpj(cnpj)) {
      cnpjsInvalidos.push(cnpjRaw || '(vazio)')
      continue
    }

    const categoriaCompra = colunaCategoria
      ? String(linha[colunaCategoria] ?? '').trim().slice(0, 200) || undefined
      : undefined

    if (!valorMensalStr && colunaValor) semValorCnpj++
    linhasValidas.push({ cnpj, nomeErp, valorMedioComprasMensal: valorMensalStr, valorRaw, categoriaCompra })
  }

  // --- Fase 2: batch insert em lotes de 500 + atualização de preços dos já cadastrados ---
  const LOTE = 500
  let inseridos = 0
  let duplicatas = 0
  let precoAtualizados = 0
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
            categoriaCompra: r.categoriaCompra,
            statusEnriquecimento: 'pendente' as const,
          }))
        )
        .onConflictDoNothing({ target: [fornecedores.cnpj, fornecedores.empresaId] })
        .returning({ id: fornecedores.id, cnpj: fornecedores.cnpj })

      inseridos += inseridos_rows.length
      const insertedCnpjs = new Set(inseridos_rows.map((r) => r.cnpj))

      for (const row of inseridos_rows) {
        jobsParaFila.push({ cnpj: row.cnpj, fornecedorId: row.id, empresaId: empresa.id })
      }

      // Atualizar preço dos fornecedores que já existiam (não inseridos agora)
      // Isso permite re-importar a planilha com o período correto e corrigir preços errados.
      const existentes = lote.filter((r) => !insertedCnpjs.has(r.cnpj))
      const paraAtualizar = existentes.filter((r) => r.valorMedioComprasMensal !== undefined)
      duplicatas += existentes.length - paraAtualizar.length

      if (paraAtualizar.length > 0) {
        await Promise.all(
          paraAtualizar.map((r) =>
            db
              .update(fornecedores)
              .set({
                valorMedioComprasMensal: r.valorMedioComprasMensal,
                ...(r.nomeErp ? { nomeErp: r.nomeErp } : {}),
                ...(r.categoriaCompra !== undefined ? { categoriaCompra: r.categoriaCompra } : {}),
              })
              .where(
                and(eq(fornecedores.cnpj, r.cnpj), eq(fornecedores.empresaId, empresa.id))
              )
          )
        )
        precoAtualizados += paraAtualizar.length
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
              categoriaCompra: r.categoriaCompra,
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

  // --- Fase 2b: inserir/atualizar pessoas físicas com 0% de crédito ---
  // - ID determinístico (14 chars) → reimportação atualiza em vez de duplicar
  // - status 'concluido' → nunca entra na fila de enriquecimento
  // - regime 'isento' + setor 'misto' → aparece na tela Estratégia com 0% crédito
  let pessoasFisicasInseridas = 0
  for (const pf of pessoasFisicas) {
    try {
      await db
        .insert(fornecedores)
        .values({
          empresaId: empresa.id,
          cnpj: pf.pfCnpj,
          nomeErp: pf.nomeErp,
          valorMedioComprasMensal: pf.valorMedioComprasMensal,
          categoriaCompra: pf.categoriaCompra,
          razaoSocial: pf.nomeErp ?? null,
          regime: 'isento' as const,
          setor: 'misto' as const,
          geraCredito: false,
          percentualCreditoEstimado: '0',
          reducaoAliquota: '0',
          statusEnriquecimento: 'concluido' as const,
          ultimoEnriquecimentoEm: new Date(),
        })
        .onConflictDoUpdate({
          target: [fornecedores.cnpj, fornecedores.empresaId],
          set: {
            nomeErp: pf.nomeErp,
            valorMedioComprasMensal: pf.valorMedioComprasMensal,
            ...(pf.categoriaCompra !== undefined ? { categoriaCompra: pf.categoriaCompra } : {}),
          },
        })
      pessoasFisicasInseridas++
    } catch (e) {
      console.error('[importar] erro ao inserir pessoa física:', String(e))
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

  // Amostra dos primeiros 5 valores brutos lidos da coluna detectada (diagnóstico)
  const amostraValores = colunaValor
    ? linhas.slice(0, 5).map((l) => ({
        raw: String(l[colunaValor] ?? ''),
        parsed: parsearValor(String(l[colunaValor] ?? '')),
        mensal: (() => {
          const v = parsearValor(String(l[colunaValor] ?? ''))
          return v > 0 ? v / divisorPeriodo : null
        })(),
      }))
    : []

  return NextResponse.json({
    total: linhas.length,
    inseridos,
    precoAtualizados,
    duplicatas,
    pessoasFisicas: pessoasFisicasInseridas,
    erros: cnpjsInvalidos.length,
    semValor: semValorCnpj,
    cnpjsInvalidos: cnpjsInvalidos.slice(0, 50),
    periodoDetectado,
    colunaValorDetectada: colunaValor ?? null,
    todasColunas: colunas, // lista completa para o usuário selecionar a correta
    amostraValores,        // primeiros 5 valores: bruto, parsed e mensal após divisor
    colunaCategoriaDetectada: colunaCategoria ?? null,
    avisoFila: filaErro ? 'Fornecedores salvos, mas fila de enriquecimento falhou. Clique "Enriquecer tudo" na tela de Fornecedores.' : null,
    avisoCpf: pessoasFisicasInseridas > 0 ? `${pessoasFisicasInseridas} pessoa(s) física(s) importada(s) sem crédito de CBS/IBS — nenhum número de CPF armazenado.` : null,
    avisoSemValor: semValorCnpj > 0 ? `${semValorCnpj} fornecedor(es) importado(s) sem valor — célula vazia, zero ou com texto não reconhecido (ex: "-", "N/A"). O campo preço pode ser preenchido manualmente depois.` : null,
    avisoPrecos: precoAtualizados > 0 ? `${precoAtualizados} fornecedor(es) já cadastrado(s) tiveram o preço atualizado com os valores desta importação.` : null,
  })
}
