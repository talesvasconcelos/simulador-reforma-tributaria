import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const schemaEdicao = z.object({
  valorMedioComprasMensal: z.number().positive().optional(),
  precoReferencia: z.number().positive().optional(),
  categoriaCompra: z.string().max(200).optional(),
  opcaoCbsIbsPorFora: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })
  if (!empresa) {
    return NextResponse.json({ error: 'Empresa não cadastrada' }, { status: 404 })
  }

  const fornecedor = await db.query.fornecedores.findFirst({
    where: and(eq(fornecedores.id, id), eq(fornecedores.empresaId, empresa.id)),
  })
  if (!fornecedor) {
    return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 })
  }

  const body = await req.json()
  const parse = schemaEdicao.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const dados = parse.data
  const [atualizado] = await db
    .update(fornecedores)
    .set({
      ...(dados.valorMedioComprasMensal !== undefined && {
        valorMedioComprasMensal: String(dados.valorMedioComprasMensal),
      }),
      ...(dados.precoReferencia !== undefined && {
        precoReferencia: String(dados.precoReferencia),
      }),
      ...(dados.categoriaCompra !== undefined && { categoriaCompra: dados.categoriaCompra }),
      ...(dados.opcaoCbsIbsPorFora !== undefined && { opcaoCbsIbsPorFora: dados.opcaoCbsIbsPorFora }),
      atualizadoEm: new Date(),
    })
    .where(and(eq(fornecedores.id, id), eq(fornecedores.empresaId, empresa.id)))
    .returning()

  return NextResponse.json(atualizado)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })
  if (!empresa) {
    return NextResponse.json({ error: 'Empresa não cadastrada' }, { status: 404 })
  }

  const fornecedor = await db.query.fornecedores.findFirst({
    where: and(eq(fornecedores.id, id), eq(fornecedores.empresaId, empresa.id)),
  })
  if (!fornecedor) {
    return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 })
  }

  await db
    .update(fornecedores)
    .set({ ativo: false, atualizadoEm: new Date() })
    .where(eq(fornecedores.id, id))

  return NextResponse.json({ ok: true })
}
