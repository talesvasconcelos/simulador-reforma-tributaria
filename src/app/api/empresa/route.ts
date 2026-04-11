import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { empresas } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const schemaNovaEmpresa = z.object({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve ter 14 dígitos numéricos'),
  razaoSocial: z.string().min(3).max(500),
  nomeFantasia: z.string().max(500).optional(),
  regime: z.enum([
    'simples_nacional', 'mei', 'lucro_presumido', 'lucro_real',
    'nanoempreendedor', 'isento', 'nao_identificado',
  ]),
  setor: z.enum([
    'industria', 'comercio_atacado', 'comercio_varejo', 'servicos',
    'servicos_saude', 'servicos_educacao', 'servicos_financeiros',
    'agronegocio', 'construcao_civil', 'transporte', 'tecnologia', 'misto',
  ]),
  uf: z.string().length(2),
  municipio: z.string().min(2).max(200),
  faturamentoAnual: z.number().positive().optional(),
  aliquotaIcmsAtual: z.number().min(0).max(100).optional(),
  aliquotaIssAtual: z.number().min(0).max(100).optional(),
  isExportadora: z.boolean().optional(),
  possuiBeneficioFiscal: z.boolean().optional(),
  descricaoBeneficio: z.string().optional(),
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

  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json()
  const parse = schemaNovaEmpresa.safeParse(body)

  if (!parse.success) {
    return NextResponse.json(
      { error: 'Dados inválidos' },
      { status: 400 }
    )
  }

  const dados = parse.data

  // Se ainda não há organização, cria uma no Clerk vinculada ao usuário
  let novaOrg = false
  if (!orgId) {
    try {
      const clerk = await clerkClient()
      const org = await clerk.organizations.createOrganization({
        name: dados.razaoSocial,
        createdBy: userId,
      })
      orgId = org.id
      novaOrg = true
    } catch {
      return NextResponse.json({ error: 'Erro ao criar organização' }, { status: 500 })
    }
  }

  const [empresa] = await db
    .insert(empresas)
    .values({
      organizationId: orgId,
      userId,
      cnpj: dados.cnpj,
      razaoSocial: dados.razaoSocial,
      nomeFantasia: dados.nomeFantasia,
      regime: dados.regime,
      setor: dados.setor,
      uf: dados.uf,
      municipio: dados.municipio,
      faturamentoAnual: dados.faturamentoAnual?.toString(),
      aliquotaIcmsAtual: dados.aliquotaIcmsAtual?.toString(),
      aliquotaIssAtual: dados.aliquotaIssAtual?.toString(),
      isExportadora: dados.isExportadora ?? false,
      possuiBeneficioFiscal: dados.possuiBeneficioFiscal ?? false,
      descricaoBeneficio: dados.descricaoBeneficio,
    })
    .returning()

  return NextResponse.json({ ...empresa, orgId: novaOrg ? orgId : undefined }, { status: 201 })
}

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

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })

  if (!empresa) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
  }

  return NextResponse.json(empresa)
}

export async function PATCH(req: NextRequest) {
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

  const body = await req.json()
  const parse = schemaNovaEmpresa.partial().safeParse(body)

  if (!parse.success) {
    return NextResponse.json(
      { error: 'Dados inválidos' },
      { status: 400 }
    )
  }

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })

  if (!empresa) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
  }

  const dados = parse.data
  const [atualizada] = await db
    .update(empresas)
    .set({
      ...dados,
      faturamentoAnual: dados.faturamentoAnual?.toString(),
      aliquotaIcmsAtual: dados.aliquotaIcmsAtual?.toString(),
      aliquotaIssAtual: dados.aliquotaIssAtual?.toString(),
      atualizadoEm: new Date(),
    })
    .where(eq(empresas.organizationId, orgId))
    .returning()

  return NextResponse.json(atualizada)
}
