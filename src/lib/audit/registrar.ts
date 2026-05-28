import { db } from '@/lib/db'
import { auditoria } from '@/lib/db/schema'

export type AcaoAuditoria =
  | 'importar_fornecedores'
  | 'exportar_csv'
  | 'deletar_dados_lgpd'
  | 'enriquecer_fornecedor'
  | 'enriquecer_todos'
  | 'adicionar_fornecedor'
  | 'editar_fornecedor'
  | 'excluir_fornecedor'
  | 'importar_faturamento'
  | 'editar_empresa'
  | 'deletar_todos_fornecedores'
  | 'solicitar_aprovacao'
  | 'aprovar_acao'
  | 'rejeitar_acao'
  | 'adicionar_ip'
  | 'remover_ip'

interface RegistrarParams {
  organizationId: string
  userId: string
  acao: AcaoAuditoria
  recurso: string
  detalhes?: Record<string, unknown>
  ip?: string | null
}

export async function registrarAudit(params: RegistrarParams): Promise<void> {
  try {
    await db.insert(auditoria).values({
      organizationId: params.organizationId,
      userId: params.userId,
      acao: params.acao,
      recurso: params.recurso,
      detalhes: params.detalhes ?? null,
      ip: params.ip ?? null,
    })
  } catch {
    // auditoria nunca pode bloquear o fluxo principal
  }
}

export function getIp(req: Request): string | null {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? null
}
