import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, simulacoes, chatHistorico } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * LGPD — Art. 18, III: Direito de acesso aos dados pessoais tratados.
 * Retorna todos os dados da organização em formato JSON para download.
 */
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

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })

  if (!empresa) {
    return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 })
  }

  const [historicoChat, historicSimulacoes] = await Promise.all([
    db.query.chatHistorico.findMany({
      where: eq(chatHistorico.empresaId, empresa.id),
      columns: { id: true, role: true, conteudo: true, criadoEm: true, sessionId: true },
      orderBy: (t, { asc }) => [asc(t.criadoEm)],
    }),
    db.query.simulacoes.findMany({
      where: eq(simulacoes.empresaId, empresa.id),
      columns: { id: true, anoSimulado: true, parametrosEntrada: true, criadoEm: true },
      orderBy: (t, { asc }) => [asc(t.criadoEm)],
    }),
  ])

  const exportacao = {
    exportadoEm: new Date().toISOString(),
    titular: { userId, organizationId: orgId },
    empresa: {
      cnpj: empresa.cnpj,
      razaoSocial: empresa.razaoSocial,
      nomeFantasia: empresa.nomeFantasia,
      regime: empresa.regime,
      setor: empresa.setor,
      uf: empresa.uf,
      municipio: empresa.municipio,
      criadoEm: empresa.criadoEm,
      atualizadoEm: empresa.atualizadoEm,
    },
    simulacoes: historicSimulacoes,
    historicoChat,
    nota: 'Exportação realizada conforme Art. 18, III da Lei 13.709/2018 (LGPD). Os dados de fornecedores são informações empresariais (CNPJ público) e não constam neste relatório de dados pessoais.',
  }

  return new NextResponse(JSON.stringify(exportacao, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dados-pessoais-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
