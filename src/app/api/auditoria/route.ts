import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { auditoria } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const LABELS: Record<string, string> = {
  importar_fornecedores: 'Importou planilha de fornecedores',
  exportar_csv: 'Exportou CSV de fornecedores',
  deletar_dados_lgpd: 'Excluiu dados (LGPD)',
  enriquecer_fornecedor: 'Enriqueceu fornecedor',
  enriquecer_todos: 'Enriqueceu todos os fornecedores',
  adicionar_fornecedor: 'Adicionou fornecedor',
  editar_fornecedor: 'Editou fornecedor',
  excluir_fornecedor: 'Excluiu fornecedor',
  importar_faturamento: 'Importou faturamento',
  editar_empresa: 'Editou dados da empresa',
  deletar_todos_fornecedores: 'Excluiu todos os fornecedores',
  solicitar_aprovacao: 'Solicitou aprovação',
  aprovar_acao: 'Aprovou ação',
  rejeitar_acao: 'Rejeitou ação',
  adicionar_ip: 'Adicionou IP à allowlist',
  remover_ip: 'Removeu IP da allowlist',
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

  const { searchParams } = new URL(req.url)
  const limite = Math.min(parseInt(searchParams.get('limite') ?? '100'), 500)

  const registros = await db.query.auditoria.findMany({
    where: eq(auditoria.organizationId, orgId),
    orderBy: [desc(auditoria.criadoEm)],
    limit: limite,
  })

  // Enriquecer com emails via Clerk (batch)
  const userIds = [...new Set(registros.map((r) => r.userId))]
  const emailMap: Record<string, string> = {}
  try {
    const clerk = await clerkClient()
    await Promise.all(
      userIds.map(async (uid) => {
        try {
          const user = await clerk.users.getUser(uid)
          emailMap[uid] = user.emailAddresses[0]?.emailAddress ?? uid
        } catch {
          emailMap[uid] = uid
        }
      })
    )
  } catch { /* continua sem emails */ }

  const resultado = registros.map((r) => ({
    ...r,
    userEmail: emailMap[r.userId] ?? r.userId,
    acaoLabel: LABELS[r.acao] ?? r.acao,
  }))

  return NextResponse.json(resultado)
}
