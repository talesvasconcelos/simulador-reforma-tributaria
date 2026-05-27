import { NextResponse } from 'next/server'

export const ROLE_GESTOR = 'org:admin'

/**
 * Retorna 403 se o usuário não for Gestor (org:admin).
 * Usar logo após a verificação de userId/orgId nas rotas de escrita.
 */
export function proibidoParaAdmin(orgRole: string | null | undefined): NextResponse | null {
  if (orgRole !== ROLE_GESTOR) {
    return NextResponse.json(
      { error: 'Acesso restrito. Esta ação requer perfil de Gestor.' },
      { status: 403 }
    )
  }
  return null
}
