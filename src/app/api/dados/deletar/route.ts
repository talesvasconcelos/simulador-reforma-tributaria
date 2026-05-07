import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, simulacoes, chatHistorico } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * LGPD — Art. 18, VI: Direito de eliminação dos dados pessoais tratados.
 *
 * Elimina os dados pessoais e histórico de uso do usuário.
 * NÃO elimina dados de fornecedores (CNPJs são dados públicos, não pessoais).
 *
 * Exige confirmação explícita via query param: ?confirmar=lgpd-direito-exclusao
 * Exige cabeçalho: X-Confirmacao-Lgpd: sim
 *
 * ATENÇÃO: esta ação é irreversível.
 */
export async function DELETE(req: NextRequest) {
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

  // Dupla confirmação para proteger contra exclusão acidental
  const { searchParams } = new URL(req.url)
  const confirmarParam = searchParams.get('confirmar')
  const confirmarHeader = req.headers.get('x-confirmacao-lgpd')

  if (confirmarParam !== 'lgpd-direito-exclusao' || confirmarHeader !== 'sim') {
    return NextResponse.json(
      {
        error: 'Confirmação obrigatória. Adicione ?confirmar=lgpd-direito-exclusao e o cabeçalho X-Confirmacao-Lgpd: sim para confirmar a exclusão.',
        instrucoes: 'Esta ação eliminará permanentemente: histórico de conversas, histórico de simulações e os dados cadastrais da empresa. Fornecedores (CNPJs públicos) não são afetados.',
      },
      { status: 400 }
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

  return NextResponse.json({
    sucesso: true,
    eliminadoEm: new Date().toISOString(),
    dados_eliminados: {
      mensagensChat: chatExcluido.length,
      simulacoes: simulacoesExcluidas.length,
      registroEmpresa: 'anonimizado',
    },
    nota: 'Dados pessoais eliminados conforme Art. 18, VI da Lei 13.709/2018 (LGPD). Os dados de fornecedores (CNPJs públicos) foram mantidos para integridade referencial.',
  })
}
