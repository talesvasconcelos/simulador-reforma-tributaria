import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

const schemaLote = z.object({
  ids: z.array(z.string().uuid()).max(500).optional(),
})

export const dynamic = 'force-dynamic'

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

  const rawBody = await req.json().catch(() => ({}))
  const parse = schemaLote.safeParse(rawBody)
  if (!parse.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }
  // ids opcional — se não informado, enfileira todos os pendentes e com erro
  const { ids } = parse.data

  const lista = await db.query.fornecedores.findMany({
    where: and(
      eq(fornecedores.empresaId, empresa.id),
      eq(fornecedores.ativo, true),
      ids?.length
        ? inArray(fornecedores.id, ids)
        : inArray(fornecedores.statusEnriquecimento, ['pendente', 'erro']),
    ),
    columns: { id: true },
  })

  if (lista.length === 0) {
    return NextResponse.json({ enfileirados: 0 })
  }

  // Marca como pendente para o cron reprocessar — não processa aqui.
  // O processamento real acontece no cron /api/cron/enriquecer-pendentes (15/min).
  // Isso evita timeout de 60s e pico de CPU com grandes volumes (7k+ fornecedores).
  await db
    .update(fornecedores)
    .set({ statusEnriquecimento: 'pendente' })
    .where(
      and(
        eq(fornecedores.empresaId, empresa.id),
        inArray(fornecedores.id, lista.map((f) => f.id)),
      )
    )

  return NextResponse.json({ enfileirados: lista.length })
}
