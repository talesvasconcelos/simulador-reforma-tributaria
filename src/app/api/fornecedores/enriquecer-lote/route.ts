import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { enriquecerCnpjPorRegras } from '@/lib/ai/enriquecimento-regras'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

  const body = await req.json().catch(() => ({}))
  // ids opcional — se não informado, enriquece todos os pendentes e com erro
  const ids: string[] | undefined = body.ids

  const lista = await db.query.fornecedores.findMany({
    where: and(
      eq(fornecedores.empresaId, empresa.id),
      eq(fornecedores.ativo, true),
      ids?.length
        ? inArray(fornecedores.id, ids)
        : inArray(fornecedores.statusEnriquecimento, ['pendente', 'erro']),
    ),
    columns: { id: true, cnpj: true },
  })

  if (lista.length === 0) {
    return NextResponse.json({ processados: 0, erros: 0 })
  }

  // Marca todos como em_processamento antes de iniciar
  await db
    .update(fornecedores)
    .set({ statusEnriquecimento: 'em_processamento' })
    .where(
      and(
        eq(fornecedores.empresaId, empresa.id),
        inArray(fornecedores.id, lista.map((f) => f.id)),
      )
    )

  // Processa em sequência para não sobrecarregar as APIs externas
  let processados = 0
  let erros = 0

  for (const f of lista) {
    try {
      await enriquecerCnpjPorRegras(f.cnpj, f.id)
      processados++
    } catch {
      erros++
    }
  }

  return NextResponse.json({ processados, erros, total: lista.length })
}
