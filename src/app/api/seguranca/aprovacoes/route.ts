import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { aprovacoesPendentes } from '@/lib/db/schema'
import { and, eq, gt } from 'drizzle-orm'
import { proibidoParaAdmin } from '@/lib/auth/roles'
import { registrarAudit, getIp } from '@/lib/audit/registrar'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET() {
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

  const pendentes = await db.query.aprovacoesPendentes.findMany({
    where: and(
      eq(aprovacoesPendentes.organizationId, orgId),
      eq(aprovacoesPendentes.status, 'pendente'),
      gt(aprovacoesPendentes.expiradoEm, new Date()),
    ),
    orderBy: (t, { desc }) => [desc(t.criadoEm)],
  })

  return NextResponse.json(pendentes)
}

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
  if (!userId || !orgId) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const bloqueado = proibidoParaAdmin(orgRole)
  if (bloqueado) return bloqueado

  const body = await req.json()
  const { acao, descricaoAcao, dadosAcao } = body

  if (!acao || !descricaoAcao) {
    return NextResponse.json({ error: 'acao e descricaoAcao são obrigatórios' }, { status: 400 })
  }

  // Verifica se há outros Gestores na organização
  let precisaAprovacao = false
  try {
    const clerk = await clerkClient()
    const membros = await clerk.organizations.getOrganizationMembershipList({ organizationId: orgId })
    const outrosGestores = membros.data.filter(
      (m) => m.role === 'org:admin' && m.publicUserData?.userId !== userId
    )
    precisaAprovacao = outrosGestores.length > 0
  } catch {
    precisaAprovacao = false
  }

  const token = randomBytes(32).toString('hex')
  const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas

  const status = precisaAprovacao ? 'pendente' : 'aprovado'

  const [aprovacao] = await db
    .insert(aprovacoesPendentes)
    .values({
      organizationId: orgId,
      solicitanteId: userId,
      acao,
      descricaoAcao,
      token,
      status,
      dadosAcao: dadosAcao ?? null,
      expiradoEm: expiraEm,
      ...(!precisaAprovacao ? { aprovadorId: userId, resolvidoEm: new Date() } : {}),
    })
    .returning()

  await registrarAudit({
    organizationId: orgId,
    userId,
    acao: 'solicitar_aprovacao',
    recurso: acao,
    detalhes: { descricaoAcao, autoAprovado: !precisaAprovacao },
    ip: getIp(req),
  })

  return NextResponse.json({
    id: aprovacao.id,
    token: aprovacao.token,
    status: aprovacao.status,
    precisaAprovacao,
    mensagem: precisaAprovacao
      ? 'Solicitação criada. Aguardando aprovação de outro Gestor da organização.'
      : 'Auto-aprovado (único Gestor na organização). Você pode prosseguir.',
  }, { status: 201 })
}
