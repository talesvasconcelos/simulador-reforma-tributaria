import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { empresas, chatHistorico } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { consultarAgente } from '@/lib/ai/agente-duvidas'
import { buscarChunksSimilares } from '@/lib/rag/buscar'

export const dynamic = 'force-dynamic'

const schemaChat = z.object({
  pergunta: z.string().min(3).max(2000),
  sessionId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  let userId: string | null = null
  let orgId: string | null = null
  try {
    const authResult = await auth()
    userId = authResult.userId
    orgId = authResult.orgId ?? null
  } catch {
    return new Response('Não autorizado', { status: 401 })
  }

  if (!userId || !orgId) {
    return new Response('Não autorizado', { status: 401 })
  }

  const body = await req.json()
  const parse = schemaChat.safeParse(body)

  if (!parse.success) {
    return new Response(JSON.stringify({ error: 'Dados inválidos' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { pergunta, sessionId } = parse.data

  // Buscar empresa da organização
  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })

  if (!empresa) {
    return new Response(
      JSON.stringify({ error: 'Empresa não cadastrada. Complete o onboarding primeiro.' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Buscar histórico de chat
  const historicoDb = sessionId
    ? await db.query.chatHistorico.findMany({
        where: eq(chatHistorico.sessionId, sessionId as `${string}-${string}-${string}-${string}-${string}`),
        orderBy: [desc(chatHistorico.criadoEm)],
        limit: 10,
      })
    : []

  const historico = historicoDb
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', conteudo: m.conteudo }))

  // Buscar chunks relevantes para auditoria
  const chunks = await buscarChunksSimilares(pergunta, 5, empresa.setor)

  const contexto = {
    empresa: {
      regime: empresa.regime,
      setor: empresa.setor,
      uf: empresa.uf,
      municipio: empresa.municipio,
      faturamentoAnual: empresa.faturamentoAnual,
    },
    chunks,
    historico,
  }

  // Salvar pergunta do usuário no histórico
  const sessionIdAtual = sessionId ?? crypto.randomUUID()
  await db.insert(chatHistorico).values({
    empresaId: empresa.id,
    userId,
    sessionId: sessionIdAtual as `${string}-${string}-${string}-${string}-${string}`,
    role: 'user',
    conteudo: pergunta,
  })

  // Stream da resposta
  const encoder = new TextEncoder()
  let respostaCompleta = ''

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of consultarAgente(pergunta, contexto)) {
          respostaCompleta += chunk
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ texto: chunk })}\n\n`))
        }

        // Salvar resposta do assistente
        await db.insert(chatHistorico).values({
          empresaId: empresa.id,
          userId,
          sessionId: sessionIdAtual as `${string}-${string}-${string}-${string}-${string}`,
          role: 'assistant',
          conteudo: respostaCompleta,
          chunksUsados: chunks.map((c) => c.id),
          documentosFonte: [...new Set(chunks.map((c) => c.documentoId))],
        })

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sessionId: sessionIdAtual, fim: true })}\n\n`))
        controller.close()
      } catch (error) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ erro: 'Erro ao processar pergunta' })}\n\n`)
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
