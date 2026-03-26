import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { buscarChunksSimilares } from '@/lib/rag/buscar'

const schemaBusca = z.object({
  pergunta: z.string().min(3),
  limite: z.number().int().min(1).max(20).optional(),
  filtroSetor: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parse = schemaBusca.safeParse(body)

  if (!parse.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', detalhes: parse.error.flatten() },
      { status: 400 }
    )
  }

  const { pergunta, limite = 5, filtroSetor } = parse.data
  const chunks = await buscarChunksSimilares(pergunta, limite, filtroSetor)

  return NextResponse.json({ chunks })
}
