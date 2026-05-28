import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { aprovacoesPendentes } from '@/lib/db/schema'
import { and, eq, gt, or } from 'drizzle-orm'
import { proibidoParaAdmin } from '@/lib/auth/roles'
import { registrarAudit, getIp } from '@/lib/audit/registrar'

export const dynamic = 'force-dynamic'

// GET por token — para o solicitante verificar status
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const aprovacao = await db.query.aprovacoesPendentes.findFirst({
    where: and(
      eq(aprovacoesPendentes.organizationId, orgId),
      or(eq(aprovacoesPendentes.token, id), eq(aprovacoesPendentes.id, id)),
    ),
  })

  if (!aprovacao) return NextResponse.json({ error: 'Aprovação não encontrada' }, { status: 404 })

  // Marca como expirada se passou do prazo
  if (aprovacao.status === 'pendente' && aprovacao.expiradoEm < new Date()) {
    await db.update(aprovacoesPendentes)
      .set({ status: 'expirado' })
      .where(eq(aprovacoesPendentes.id, aprovacao.id))
    return NextResponse.json({ ...aprovacao, status: 'expirado' })
  }

  return NextResponse.json(aprovacao)
}

// PATCH — aprovar ou rejeitar (apenas Gestor diferente do solicitante)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
  if (!userId || !orgId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const bloqueado = proibidoParaAdmin(orgRole)
  if (bloqueado) return bloqueado

  const { decisao } = await req.json() // 'aprovado' | 'rejeitado'
  if (decisao !== 'aprovado' && decisao !== 'rejeitado') {
    return NextResponse.json({ error: 'decisao deve ser "aprovado" ou "rejeitado"' }, { status: 400 })
  }

  const aprovacao = await db.query.aprovacoesPendentes.findFirst({
    where: and(
      eq(aprovacoesPendentes.id, id),
      eq(aprovacoesPendentes.organizationId, orgId),
      eq(aprovacoesPendentes.status, 'pendente'),
      gt(aprovacoesPendentes.expiradoEm, new Date()),
    ),
  })

  if (!aprovacao) {
    return NextResponse.json({ error: 'Aprovação não encontrada ou já resolvida' }, { status: 404 })
  }

  if (aprovacao.solicitanteId === userId) {
    return NextResponse.json({ error: 'Você não pode aprovar sua própria solicitação' }, { status: 403 })
  }

  const [atualizada] = await db
    .update(aprovacoesPendentes)
    .set({ status: decisao, aprovadorId: userId, resolvidoEm: new Date() })
    .where(eq(aprovacoesPendentes.id, id))
    .returning()

  await registrarAudit({
    organizationId: orgId,
    userId,
    acao: decisao === 'aprovado' ? 'aprovar_acao' : 'rejeitar_acao',
    recurso: aprovacao.acao,
    detalhes: { descricaoAcao: aprovacao.descricaoAcao, solicitanteId: aprovacao.solicitanteId },
    ip: getIp(req),
  })

  return NextResponse.json(atualizada)
}
