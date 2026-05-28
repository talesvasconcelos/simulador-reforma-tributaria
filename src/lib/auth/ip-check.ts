import { db } from '@/lib/db'
import { ipPermitidos } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function verificarIpPermitido(
  ip: string | null,
  orgId: string
): Promise<NextResponse | null> {
  const lista = await db.query.ipPermitidos.findMany({
    where: eq(ipPermitidos.organizationId, orgId),
    columns: { ip: true },
  })

  if (lista.length === 0) return null // sem restrição configurada — permite tudo

  if (!ip) {
    return NextResponse.json(
      { error: 'IP de origem não identificado. Acesso bloqueado pela política de segurança da organização.' },
      { status: 403 }
    )
  }

  const permitido = lista.some(({ ip: ipCadastrado }) => ip === ipCadastrado)

  if (!permitido) {
    return NextResponse.json(
      { error: `Acesso bloqueado. O IP ${ip} não está na lista de IPs autorizados desta organização.` },
      { status: 403 }
    )
  }

  return null
}
