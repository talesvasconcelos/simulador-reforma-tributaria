import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { buscarChunksSimilares } from '@/lib/rag/buscar'
import { checkRateLimit } from '@/lib/api/rate-limit'

export const dynamic = 'force-dynamic'

const schemaBusca = z.object({
  pergunta: z.string().min(3),
  limite: z.number().int().min(1).max(20).optional(),
  filtroSetor: z.string().optional(),
})

export async function POST(req: NextRequest) {
  let userId: string | null = null
  try {
    const authResult = await auth()
    userId = authResult.userId
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Rate limit: 60 buscas por hora por usuário (cada busca = Voyage AI + pgvector)
  const { allowed } = await checkRateLimit(`rag:${userId}`, 60, 3600)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Limite de buscas atingido. Tente novamente em uma hora.' },
      { status: 429 }
    )
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
