import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { adicionarNaFila } from '@/lib/filas/queue'
import { normalizarCnpj, validarCnpj } from '@/lib/utils'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()

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

  const buffer = await arquivo.arrayBuffer()
  const nomeArquivo = arquivo.name.toLowerCase()

  // Detectar tipo e fazer parse
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
    return NextResponse.json(
      { error: 'Formato inválido. Envie CSV ou XLSX.' },
      { status: 400 }
    )
  }

  // Detectar coluna CNPJ automaticamente
  const colunas = Object.keys(linhas[0] ?? {})
  const colunaCnpj = colunas.find(
    (c) => c.toLowerCase().includes('cnpj') || c.toLowerCase().includes('cpf_cnpj')
  )
  const colunaValor = colunas.find(
    (c) =>
      c.toLowerCase().includes('valor') ||
      c.toLowerCase().includes('compra') ||
      c.toLowerCase().includes('total')
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

  let inseridos = 0
  let duplicatas = 0
  let erros = 0
  const cnpjsInvalidos: string[] = []
  const jobsParaFila: Array<{ cnpj: string; fornecedorId: string; empresaId: string }> = []

  for (const linha of linhas) {
    const cnpjRaw = String(linha[colunaCnpj] ?? '')
    const cnpj = normalizarCnpj(cnpjRaw)

    if (!cnpj || !validarCnpj(cnpj)) {
      cnpjsInvalidos.push(cnpjRaw)
      erros++
      continue
    }

    const nomeErp = colunaNome ? String(linha[colunaNome] ?? '') : undefined
    const valorStr = colunaValor ? String(linha[colunaValor] ?? '').replace(/\D/g, '') : undefined
    const valorMedio = valorStr ? parseInt(valorStr) / 100 : undefined

    try {
      const [novo] = await db
        .insert(fornecedores)
        .values({
          empresaId: empresa.id,
          cnpj,
          nomeErp: nomeErp || undefined,
          valorMedioComprasMensal: valorMedio?.toString(),
          statusEnriquecimento: 'pendente',
        })
        .onConflictDoNothing({ target: [fornecedores.cnpj, fornecedores.empresaId] })
        .returning({ id: fornecedores.id })

      if (novo) {
        inseridos++
        jobsParaFila.push({ cnpj, fornecedorId: novo.id, empresaId: empresa.id })
      } else {
        duplicatas++
      }
    } catch {
      erros++
    }
  }

  // Adicionar na fila de enriquecimento
  if (jobsParaFila.length > 0) {
    await adicionarNaFila(jobsParaFila)
  }

  return NextResponse.json({
    total: linhas.length,
    inseridos,
    duplicatas,
    erros,
    cnpjsInvalidos: cnpjsInvalidos.slice(0, 20), // Limitar lista de erros
  })
}
