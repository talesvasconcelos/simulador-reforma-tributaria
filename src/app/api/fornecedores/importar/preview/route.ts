import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

/**
 * Faz o parse apenas do cabeçalho e primeiras 5 linhas do arquivo.
 * Não importa nada — apenas retorna colunas e amostra de valores para
 * o usuário confirmar qual coluna usar antes de importar.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await auth()
    if (!authResult.userId || !authResult.orgId) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const formData = await req.formData()
  const arquivo = formData.get('arquivo') as File | null

  if (!arquivo) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (arquivo.size > 50 * 1024 * 1024) return NextResponse.json({ error: 'Arquivo muito grande.' }, { status: 413 })

  const buffer = await arquivo.arrayBuffer()
  const nome = arquivo.name.toLowerCase()

  let linhas: Record<string, string>[] = []

  if (nome.endsWith('.csv')) {
    const texto = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '')
    const primeiraLinha = texto.split(/\r?\n/)[0] ?? ''
    const sep = primeiraLinha.includes(';') && !primeiraLinha.includes(',') ? ';' : ','
    const result = Papa.parse<Record<string, string>>(texto, {
      header: true, skipEmptyLines: true, delimiter: sep,
      transformHeader: (h) => h.trim(),
    })
    linhas = result.data.slice(0, 5)
  } else if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    linhas = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' }).slice(0, 5)
  } else {
    return NextResponse.json({ error: 'Formato inválido. Envie CSV ou XLSX.' }, { status: 400 })
  }

  if (linhas.length === 0) return NextResponse.json({ error: 'Arquivo vazio.' }, { status: 400 })

  const colunas = Object.keys(linhas[0] ?? {})

  // Para cada coluna, retorna os 5 primeiros valores (brutos) para o usuário identificar qual é a de preço
  const preview = colunas.map((col) => ({
    coluna: col,
    valores: linhas.map((l) => String(l[col] ?? '')),
  }))

  return NextResponse.json({ colunas, preview })
}
