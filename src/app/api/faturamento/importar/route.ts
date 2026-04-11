import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, faturamentoMensal } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

// Mapas de nomes de meses em português para número
const MESES_EXTENSO: Record<string, string> = {
  janeiro: '01', fevereiro: '02', março: '03', abril: '04',
  maio: '05', junho: '06', julho: '07', agosto: '08',
  setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
}
const MESES_ABREV: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04',
  mai: '05', jun: '06', jul: '07', ago: '08',
  set: '09', out: '10', nov: '11', dez: '12',
}

/**
 * Converte uma string de competência para o formato "YYYY-MM".
 * Aceita: "2025-01", "01/2025", "Jan/2025", "Jan 2025", "Janeiro/2025", "01-2025".
 * Retorna null se não conseguir parsear.
 */
function parsearCompetencia(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null

  // Formato ISO: 2025-01
  const isoMatch = s.match(/^(\d{4})-(\d{2})$/)
  if (isoMatch) {
    const mes = parseInt(isoMatch[2])
    if (mes >= 1 && mes <= 12) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}`
  }

  // Formato BR: 01/2025 ou 01-2025
  const brMatch = s.match(/^(\d{1,2})[\/\-](\d{4})$/)
  if (brMatch) {
    const mes = parseInt(brMatch[1])
    if (mes >= 1 && mes <= 12) return `${brMatch[2]}-${String(mes).padStart(2, '0')}`
  }

  // Separador com nome: Jan/2025, Jan 2025, Janeiro/2025, Janeiro 2025
  const nomeMatch = s.match(/^([A-Za-zÀ-ú]+)[\/\s\-](\d{4})$/i)
  if (nomeMatch) {
    const nomeMes = nomeMatch[1].toLowerCase()
    const ano = nomeMatch[2]
    const mesNum = MESES_EXTENSO[nomeMes] ?? MESES_ABREV[nomeMes]
    if (mesNum) return `${ano}-${mesNum}`
  }

  // Tentativa inversa: 2025/01 (menos comum)
  const invMatch = s.match(/^(\d{4})[\/](\d{2})$/)
  if (invMatch) {
    const mes = parseInt(invMatch[2])
    if (mes >= 1 && mes <= 12) return `${invMatch[1]}-${invMatch[2].padStart(2, '0')}`
  }

  return null
}

/**
 * Converte string de valor monetário para número float.
 * Suporta formato BR (1.200,50) e US (1,200.50), com ou sem R$.
 */
function parsearValor(raw: string): number {
  const limpo = raw.trim().replace(/R\$\s*/i, '').replace(/\s/g, '')
  if (!limpo) return 0

  const temVirgula = limpo.includes(',')
  const temPonto = limpo.includes('.')

  if (temVirgula && temPonto) {
    if (limpo.lastIndexOf(',') > limpo.lastIndexOf('.')) {
      return parseFloat(limpo.replace(/\./g, '').replace(',', '.')) || 0
    } else {
      return parseFloat(limpo.replace(/,/g, '')) || 0
    }
  }
  if (temVirgula) {
    const partes = limpo.split(',')
    if (partes.length === 2 && partes[1].length <= 2) {
      return parseFloat(limpo.replace(',', '.')) || 0
    }
    return parseFloat(limpo.replace(/,/g, '')) || 0
  }
  if (temPonto) {
    const partes = limpo.split('.')
    if (partes.length === 2 && partes[1].length <= 2) {
      return parseFloat(limpo) || 0
    }
    return parseFloat(limpo.replace(/\./g, '')) || 0
  }
  return parseFloat(limpo) || 0
}

const NOMES_COMPETENCIA = ['competencia', 'mes', 'mês', 'month', 'periodo', 'período', 'referencia', 'referência']
const NOMES_VALOR_TOTAL = ['valor_total', 'faturamento', 'valor', 'receita', 'total', 'venda', 'vendas']
const NOMES_B2B = ['valor_b2b', 'b2b', 'privado', 'empresas']
const NOMES_PUBLICO = ['valor_publico', 'publico', 'público', 'governo', 'public']
const NOMES_B2C = ['valor_b2c', 'b2c', 'consumidor', 'pessoa_fisica', 'pf']

function detectarColuna(colunas: string[], candidatos: string[]): string | undefined {
  const colsLower = colunas.map((c) => c.toLowerCase().trim())
  // Correspondência exata primeiro
  for (const cand of candidatos) {
    const idx = colsLower.indexOf(cand)
    if (idx !== -1) return colunas[idx]
  }
  // Correspondência parcial (contém)
  for (const cand of candidatos) {
    const idx = colsLower.findIndex((c) => c.includes(cand))
    if (idx !== -1) return colunas[idx]
  }
  return undefined
}

export async function POST(req: NextRequest) {
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

  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB (faturamento mensal: muito menos linhas)
  if (arquivo.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'Arquivo muito grande. Limite: 20 MB.' }, { status: 413 })
  }

  const buffer = await arquivo.arrayBuffer()
  const nomeArquivo = arquivo.name.toLowerCase()

  let linhas: Record<string, string>[] = []

  if (nomeArquivo.endsWith('.csv')) {
    const texto = new TextDecoder('utf-8').decode(buffer)
    const resultado = Papa.parse<Record<string, string>>(texto, {
      header: true,
      skipEmptyLines: true,
    })
    linhas = resultado.data
  } else if (nomeArquivo.endsWith('.xlsx') || nomeArquivo.endsWith('.xls')) {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const primeiraSheet = workbook.Sheets[workbook.SheetNames[0]]
    linhas = XLSX.utils.sheet_to_json<Record<string, string>>(primeiraSheet, {
      defval: '',
    })
  } else {
    return NextResponse.json({ error: 'Formato inválido. Envie CSV ou XLSX.' }, { status: 400 })
  }

  if (linhas.length === 0) {
    return NextResponse.json({ error: 'Arquivo vazio ou sem dados.' }, { status: 400 })
  }

  // Faturamento mensal: máximo 1.200 linhas (100 anos × 12 meses — mais que suficiente)
  if (linhas.length > 1200) {
    return NextResponse.json(
      { error: `Arquivo com muitas linhas (${linhas.length}). Máximo: 1.200 linhas por importação.` },
      { status: 413 }
    )
  }

  const colunas = Object.keys(linhas[0] ?? {})

  const colunaCompetencia = detectarColuna(colunas, NOMES_COMPETENCIA)
  const colunaValorTotal = detectarColuna(colunas, NOMES_VALOR_TOTAL)
  const colunaB2B = detectarColuna(colunas, NOMES_B2B)
  const colunaPublico = detectarColuna(colunas, NOMES_PUBLICO)
  const colunaB2C = detectarColuna(colunas, NOMES_B2C)

  if (!colunaCompetencia) {
    return NextResponse.json(
      { error: 'Coluna de competência não encontrada. Inclua uma coluna "competencia", "mes" ou "periodo".' },
      { status: 400 }
    )
  }

  if (!colunaValorTotal) {
    return NextResponse.json(
      { error: 'Coluna de faturamento não encontrada. Inclua "valor_total", "faturamento" ou "receita".' },
      { status: 400 }
    )
  }

  const temBreakdownClientes = !!(colunaB2B || colunaPublico || colunaB2C)

  let total = linhas.length
  let inseridos = 0
  let atualizados = 0
  let erros = 0
  let anoDetectado: number | null = null

  for (const linha of linhas) {
    const competenciaRaw = String(linha[colunaCompetencia] ?? '').trim()
    const competencia = parsearCompetencia(competenciaRaw)

    if (!competencia) {
      erros++
      continue
    }

    const ano = parseInt(competencia.split('-')[0])
    if (!anoDetectado) anoDetectado = ano

    const valorTotalNum = parsearValor(String(linha[colunaValorTotal] ?? ''))
    if (valorTotalNum <= 0) {
      erros++
      continue
    }

    const valorB2BNum = colunaB2B ? parsearValor(String(linha[colunaB2B] ?? '')) : undefined
    const valorPublicoNum = colunaPublico ? parsearValor(String(linha[colunaPublico] ?? '')) : undefined
    const valorB2CNum = colunaB2C ? parsearValor(String(linha[colunaB2C] ?? '')) : undefined

    try {
      const existing = await db.query.faturamentoMensal.findFirst({
        where: (t, { and: andOp, eq: eqOp }) =>
          andOp(eqOp(t.empresaId, empresa.id), eqOp(t.competencia, competencia)),
      })

      if (existing) {
        await db
          .update(faturamentoMensal)
          .set({
            valorTotal: String(valorTotalNum),
            anoReferencia: ano,
            valorB2B: valorB2BNum !== undefined ? String(valorB2BNum) : null,
            valorPublico: valorPublicoNum !== undefined ? String(valorPublicoNum) : null,
            valorB2C: valorB2CNum !== undefined ? String(valorB2CNum) : null,
          })
          .where(eq(faturamentoMensal.id, existing.id))
        atualizados++
      } else {
        await db.insert(faturamentoMensal).values({
          empresaId: empresa.id,
          competencia,
          anoReferencia: ano,
          valorTotal: String(valorTotalNum),
          valorB2B: valorB2BNum !== undefined ? String(valorB2BNum) : null,
          valorPublico: valorPublicoNum !== undefined ? String(valorPublicoNum) : null,
          valorB2C: valorB2CNum !== undefined ? String(valorB2CNum) : null,
        })
        inseridos++
      }
    } catch {
      erros++
    }
  }

  return NextResponse.json({
    total,
    inseridos,
    atualizados,
    erros,
    anoDetectado,
    colunaCompetenciaDetectada: colunaCompetencia,
    colunaValorDetectada: colunaValorTotal,
    temBreakdownClientes,
  })
}
