import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { enriquecerCnpjPorRegras } from '@/lib/ai/enriquecimento-regras'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { proibidoParaAdmin } from '@/lib/auth/roles'
import { registrarAudit, getIp } from '@/lib/audit/registrar'
import { verificarIpPermitido } from '@/lib/auth/ip-check'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  let userId: string | null = null
  let orgId: string | null = null
  let orgRole: string | null = null
  try {
    const authResult = await auth()
    userId = authResult.userId
    orgId = authResult.orgId ?? null
    orgRole = authResult.orgRole ?? null
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const bloqueado = proibidoParaAdmin(orgRole)
  if (bloqueado) return bloqueado

  const bloqueadoIp = await verificarIpPermitido(getIp(req), orgId)
  if (bloqueadoIp) return bloqueadoIp

  // Rate limit: 10 enriquecimentos manuais por minuto por usuário
  const { allowed } = await checkRateLimit(`enriquecer:${userId}`, 10, 60)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento antes de enriquecer outro fornecedor.' },
      { status: 429 }
    )
  }

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })
  if (!empresa) {
    return NextResponse.json({ error: 'Empresa não cadastrada' }, { status: 404 })
  }

  const { fornecedorId } = await req.json()

  const fornecedor = await db.query.fornecedores.findFirst({
    where: and(
      eq(fornecedores.id, fornecedorId),
      eq(fornecedores.empresaId, empresa.id)
    ),
  })
  if (!fornecedor) {
    return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 })
  }

  await db
    .update(fornecedores)
    .set({ statusEnriquecimento: 'em_processamento' })
    .where(eq(fornecedores.id, fornecedorId))

  try {
    await enriquecerCnpjPorRegras(fornecedor.cnpj, fornecedorId)

    const atualizado = await db.query.fornecedores.findFirst({
      where: eq(fornecedores.id, fornecedorId),
    })

    await registrarAudit({
      organizationId: orgId!,
      userId: userId!,
      acao: 'enriquecer_fornecedor',
      recurso: 'fornecedores',
      detalhes: { fornecedorId, cnpj: fornecedor.cnpj },
      ip: getIp(req),
    })
    return NextResponse.json({ sucesso: true, fornecedor: atualizado })
  } catch (err: unknown) {
    console.error('[fornecedores/enriquecer] Erro ao enriquecer fornecedor:', err)
    return NextResponse.json({ error: 'Erro interno ao enriquecer fornecedor. Tente novamente.' }, { status: 500 })
  }
}
