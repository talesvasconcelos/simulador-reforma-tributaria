import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()

  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Buscar empresa da organização
  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })

  if (!empresa) {
    return NextResponse.json({ error: 'Empresa não cadastrada' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const regime = searchParams.get('regime')
  const setor = searchParams.get('setor')
  const status = searchParams.get('status')
  const pagina = parseInt(searchParams.get('pagina') ?? '1')
  const porPagina = parseInt(searchParams.get('porPagina') ?? '50')

  // Construir filtros
  const filtros = [
    eq(fornecedores.empresaId, empresa.id),
    eq(fornecedores.ativo, true),
  ]

  const lista = await db.query.fornecedores.findMany({
    where: and(...filtros),
    limit: porPagina,
    offset: (pagina - 1) * porPagina,
    orderBy: (t, { desc }) => [desc(t.criadoEm)],
  })

  return NextResponse.json({
    fornecedores: lista,
    pagina,
    porPagina,
    total: lista.length,
  })
}

const schemaFornecedor = z.object({
  cnpj: z.string().regex(/^\d{14}$/),
  nomeErp: z.string().max(500).optional(),
  codigoErp: z.string().max(100).optional(),
  valorMedioComprasMensal: z.number().positive().optional(),
  categoriaCompra: z.string().max(200).optional(),
})

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

  const body = await req.json()
  const parse = schemaFornecedor.safeParse(body)

  if (!parse.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', detalhes: parse.error.flatten() },
      { status: 400 }
    )
  }

  const [fornecedor] = await db
    .insert(fornecedores)
    .values({
      empresaId: empresa.id,
      ...parse.data,
      valorMedioComprasMensal: parse.data.valorMedioComprasMensal?.toString(),
    })
    .onConflictDoNothing({ target: [fornecedores.cnpj, fornecedores.empresaId] })
    .returning()

  return NextResponse.json(fornecedor, { status: 201 })
}
