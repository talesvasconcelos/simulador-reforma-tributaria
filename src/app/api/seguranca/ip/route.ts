import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ipPermitidos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { proibidoParaAdmin } from '@/lib/auth/roles'
import { registrarAudit, getIp } from '@/lib/audit/registrar'

export const dynamic = 'force-dynamic'

const schemaIp = z.object({
  ip: z.string().regex(
    /^(\d{1,3}\.){3}\d{1,3}$/,
    'Formato inválido. Use IPv4 (ex: 200.100.50.10)'
  ),
  descricao: z.string().max(200).optional(),
})

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

  const lista = await db.query.ipPermitidos.findMany({
    where: eq(ipPermitidos.organizationId, orgId),
    orderBy: (t, { desc }) => [desc(t.criadoEm)],
  })

  return NextResponse.json(lista)
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
  const parse = schemaIp.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 })
  }

  const [novo] = await db
    .insert(ipPermitidos)
    .values({
      organizationId: orgId,
      ip: parse.data.ip,
      descricao: parse.data.descricao ?? null,
    })
    .returning()

  await registrarAudit({
    organizationId: orgId,
    userId,
    acao: 'adicionar_ip',
    recurso: 'ip_permitidos',
    detalhes: { ip: parse.data.ip, descricao: parse.data.descricao },
    ip: getIp(req),
  })

  return NextResponse.json(novo, { status: 201 })
}
