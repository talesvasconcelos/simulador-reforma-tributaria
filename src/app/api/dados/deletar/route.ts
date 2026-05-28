import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, simulacoes, chatHistorico, aprovacoesPendentes } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'
import { proibidoParaAdmin } from '@/lib/auth/roles'
import { registrarAudit, getIp } from '@/lib/audit/registrar'
import { verificarIpPermitido } from '@/lib/auth/ip-check'

export const dynamic = 'force-dynamic'

/**
 * LGPD — Art. 18, VI: Direito de eliminação dos dados pessoais tratados.
 *
 * Requer dupla aprovação quando há mais de um Gestor na organização:
 *   1. POST /api/seguranca/aprovacoes → cria solicitação, retorna token
 *   2. Outro Gestor aprova via PATCH /api/seguranca/aprovacoes/[id]
 *   3. DELETE /api/dados/deletar?token=xxx → executa a exclusão
 *
 * Com apenas 1 Gestor: o token é auto-aprovado e pode ser usado imediatamente.
 *
 * Exige também confirmação explícita via query param: ?confirmar=lgpd-direito-exclusao
 * Exige cabeçalho: X-Confirmacao-Lgpd: sim
 */
export async function DELETE(req: NextRequest) {
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

  // Confirmações obrigatórias
  const { searchParams } = new URL(req.url)
  const confirmarParam = searchParams.get('confirmar')
  const confirmarHeader = req.headers.get('x-confirmacao-lgpd')
  const token = searchParams.get('token')

  if (confirmarParam !== 'lgpd-direito-exclusao' || confirmarHeader !== 'sim') {
    return NextResponse.json(
      {
        error: 'Confirmação obrigatória. Adicione ?confirmar=lgpd-direito-exclusao e o cabeçalho X-Confirmacao-Lgpd: sim.',
        instrucoes: 'Esta ação elimina permanentemente: histórico de conversas, histórico de simulações e dados cadastrais da empresa.',
      },
      { status: 400 }
    )
  }

  // Verificar token de aprovação dupla
  if (!token) {
    return NextResponse.json(
      {
        error: 'Token de aprovação obrigatório. Crie uma solicitação via POST /api/seguranca/aprovacoes primeiro.',
        instrucoes: 'A exclusão de dados requer aprovação de outro Gestor da organização (ou auto-aprovação se você for o único Gestor).',
      },
      { status: 400 }
    )
  }

  const aprovacao = await db.query.aprovacoesPendentes.findFirst({
    where: and(
      eq(aprovacoesPendentes.token, token),
      eq(aprovacoesPendentes.organizationId, orgId),
      eq(aprovacoesPendentes.status, 'aprovado'),
      gt(aprovacoesPendentes.expiradoEm, new Date()),
    ),
  })

  if (!aprovacao) {
    return NextResponse.json(
      { error: 'Token inválido, não aprovado ou expirado. Crie uma nova solicitação de aprovação.' },
      { status: 403 }
    )
  }

  if (aprovacao.solicitanteId !== userId) {
    return NextResponse.json(
      { error: 'Este token pertence a outro usuário.' },
      { status: 403 }
    )
  }

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
    columns: { id: true },
  })

  if (!empresa) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
  }

  // Eliminar dados pessoais na ordem correta (respeita foreign keys)
  const [chatExcluido, simulacoesExcluidas] = await Promise.all([
    db.delete(chatHistorico).where(eq(chatHistorico.empresaId, empresa.id)).returning({ id: chatHistorico.id }),
    db.delete(simulacoes).where(eq(simulacoes.empresaId, empresa.id)).returning({ id: simulacoes.id }),
  ])

  // Anonimizar registro da empresa (mantém integridade referencial dos fornecedores)
  await db
    .update(empresas)
    .set({
      razaoSocial: '[DADOS ELIMINADOS - LGPD]',
      nomeFantasia: null,
      cnpj: `DEL${empresa.id.replace(/-/g, '').slice(0, 11)}`,
      municipio: '[eliminado]',
      faturamentoAnual: null,
      descricaoBeneficio: null,
      atualizadoEm: new Date(),
    })
    .where(eq(empresas.id, empresa.id))

  // Invalidar token de aprovação
  await db
    .update(aprovacoesPendentes)
    .set({ status: 'expirado', resolvidoEm: new Date() })
    .where(eq(aprovacoesPendentes.token, token))

  await registrarAudit({
    organizationId: orgId,
    userId,
    acao: 'deletar_dados_lgpd',
    recurso: 'dados',
    detalhes: {
      mensagensChat: chatExcluido.length,
      simulacoes: simulacoesExcluidas.length,
      aprovacaoId: aprovacao.id,
    },
    ip: getIp(req),
  })

  return NextResponse.json({
    sucesso: true,
    eliminadoEm: new Date().toISOString(),
    dados_eliminados: {
      mensagensChat: chatExcluido.length,
      simulacoes: simulacoesExcluidas.length,
      registroEmpresa: 'anonimizado',
    },
    nota: 'Dados pessoais eliminados conforme Art. 18, VI da Lei 13.709/2018 (LGPD).',
  })
}
