import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Server-Sent Events para progresso de enriquecimento em tempo real
export async function GET(req: NextRequest) {
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

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })

  if (!empresa) {
    return new Response('Empresa não encontrada', { status: 404 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (dados: object) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(dados)}\n\n`)
        )
      }

      // Enviar progresso a cada 10 segundos por até 10 minutos
      const MAX_ITERACOES = 60
      let iteracoes = 0

      const intervalo = setInterval(async () => {
        iteracoes++

        try {
          // Uma única query GROUP BY substitui 5 COUNTs separados
          const contagens = await db
            .select({
              status: fornecedores.statusEnriquecimento,
              total: count(),
            })
            .from(fornecedores)
            .where(and(eq(fornecedores.empresaId, empresa.id), eq(fornecedores.ativo, true)))
            .groupBy(fornecedores.statusEnriquecimento)

          const porStatus = Object.fromEntries(contagens.map((r) => [r.status, r.total]))
          const totalN = contagens.reduce((acc, r) => acc + r.total, 0)
          const concluidoN = porStatus['concluido'] ?? 0
          const naoEncontradoN = porStatus['nao_encontrado'] ?? 0
          const processadosN = concluidoN + naoEncontradoN
          const percentualConcluido = totalN > 0 ? Math.min(100, Math.round((processadosN / totalN) * 100)) : 0

          enviar({
            total: totalN,
            pendente: porStatus['pendente'] ?? 0,
            emProcessamento: porStatus['em_processamento'] ?? 0,
            concluido: concluidoN,
            erro: porStatus['erro'] ?? 0,
            naoEncontrado: naoEncontradoN,
            percentualConcluido,
          })

          // Parar se concluído ou limite atingido
          if (percentualConcluido >= 100 || iteracoes >= MAX_ITERACOES) {
            clearInterval(intervalo)
            controller.close()
          }
        } catch {
          clearInterval(intervalo)
          controller.close()
        }
      }, 10000)

      // Cleanup quando cliente desconectar
      req.signal.addEventListener('abort', () => {
        clearInterval(intervalo)
        controller.close()
      })
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
