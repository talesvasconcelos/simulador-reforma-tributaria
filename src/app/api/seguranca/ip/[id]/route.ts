import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { ipPermitidos } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { proibidoParaAdmin } from '@/lib/auth/roles'
import { registrarAudit, getIp } from '@/lib/audit/registrar'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const [removido] = await db
    .delete(ipPermitidos)
    .where(and(eq(ipPermitidos.id, id), eq(ipPermitidos.organizationId, orgId)))
    .returning()

  if (!removido) return NextResponse.json({ error: 'IP não encontrado' }, { status: 404 })

  await registrarAudit({
    organizationId: orgId,
    userId,
    acao: 'remover_ip',
    recurso: 'ip_permitidos',
    detalhes: { ip: removido.ip },
    ip: getIp(req),
  })

  return NextResponse.json({ sucesso: true })
}
