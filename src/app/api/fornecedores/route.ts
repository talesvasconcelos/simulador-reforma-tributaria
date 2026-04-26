import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and, count, or, ilike } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
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
  const busca = searchParams.get('busca')?.trim() ?? ''
  const pagina = Math.max(1, parseInt(searchParams.get('pagina') ?? '1'))
  const porPagina = Math.min(500, Math.max(1, parseInt(searchParams.get('porPagina') ?? '50')))

  const where = busca
    ? and(
        eq(fornecedores.empresaId, empresa.id),
        eq(fornecedores.ativo, true),
        or(
          ilike(fornecedores.razaoSocial, `%${busca}%`),
          ilike(fornecedores.nomeErp, `%${busca}%`),
          ilike(fornecedores.cnpj, `%${busca}%`),
        ),
      )
    : and(
        eq(fornecedores.empresaId, empresa.id),
        eq(fornecedores.ativo, true),
      )

  const [{ total }] = await db.select({ total: count() }).from(fornecedores).where(where)

  const lista = await db.query.fornecedores.findMany({
    where,
    limit: porPagina,
    offset: (pagina - 1) * porPagina,
    orderBy: (t, { desc }) => [desc(t.criadoEm)],
    // Exclui campo jsonb grande — não é exibido na listagem
    columns: { dadosApiCnpj: false },
  })

  return NextResponse.json({
    fornecedores: lista,
    pagina,
    porPagina,
    total,
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

  const body = await req.json()
  const parse = schemaFornecedor.safeParse(body)

  if (!parse.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const cnpjLimpo = parse.data.cnpj

  // Tentar inserir; se já existe retornar o registro existente
  const [inserido] = await db
    .insert(fornecedores)
    .values({
      empresaId: empresa.id,
      ...parse.data,
      valorMedioComprasMensal: parse.data.valorMedioComprasMensal?.toString(),
    })
    .onConflictDoNothing({ target: [fornecedores.cnpj, fornecedores.empresaId] })
    .returning()

  if (inserido) {
    return NextResponse.json(inserido, { status: 201 })
  }

  // Já existia — retornar o registro sem dadosApiCnpj (JSON bruto da Receita Federal)
  const existente = await db.query.fornecedores.findFirst({
    where: and(eq(fornecedores.cnpj, cnpjLimpo), eq(fornecedores.empresaId, empresa.id)),
    columns: { dadosApiCnpj: false },
  })

  return NextResponse.json(existente, { status: 200 })
}

// DELETE /api/fornecedores — exclui TODOS os fornecedores da empresa
export async function DELETE(req: NextRequest) {
  let userId: string | null = null
  let orgId: string | null = null
  try {
    const authResult = await auth()
    userId = authResult.userId
    orgId = authResult.orgId ?? null
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!userId || !orgId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const empresa = await db.query.empresas.findFirst({ where: eq(empresas.organizationId, orgId) })
  if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const confirmar = searchParams.get('confirmar')
  if (confirmar !== 'sim') {
    return NextResponse.json({ error: 'Passe ?confirmar=sim para confirmar a exclusão' }, { status: 400 })
  }

  const resultado = await db
    .delete(fornecedores)
    .where(eq(fornecedores.empresaId, empresa.id))
    .returning({ id: fornecedores.id })

  return NextResponse.json({ excluidos: resultado.length })
}
