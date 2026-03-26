import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { indexarDocumento } from '@/lib/rag/indexar'
import fs from 'fs'
import path from 'path'

const schemaIndexar = z.object({
  titulo: z.string().min(3),
  fonte: z.string().min(2),
  conteudo: z.string().min(100),
  tipoDocumento: z.string().optional(),
  url: z.string().url().optional(),
})

export async function POST(req: NextRequest) {
  // Protegido por CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()

  // Se 'indexarBaseLegal' for true, indexar o documento completo da reforma
  if (body.indexarBaseLegal) {
    const caminho = path.join(
      process.cwd(),
      '../Docs/reforma_tributaria_brasil_documentacao_completa.md'
    )

    if (!fs.existsSync(caminho)) {
      return NextResponse.json({ error: 'Arquivo de legislação não encontrado' }, { status: 404 })
    }

    const conteudo = fs.readFileSync(caminho, 'utf-8')

    const documentoId = await indexarDocumento({
      titulo: 'Documentação Completa — Reforma Tributária Brasileira (LC 214/2025)',
      fonte: 'LC 214/2025 + EC 132/2023',
      conteudo,
      tipoDocumento: 'lei',
      dataPublicacao: new Date('2025-01-10'),
    })

    return NextResponse.json({ documentoId, sucesso: true })
  }

  const parse = schemaIndexar.safeParse(body)

  if (!parse.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', detalhes: parse.error.flatten() },
      { status: 400 }
    )
  }

  const documentoId = await indexarDocumento(parse.data)

  return NextResponse.json({ documentoId, sucesso: true })
}
