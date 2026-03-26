import { NextRequest } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and, count } from 'drizzle-orm'

// Server-Sent Events para progresso de enriquecimento em tempo real
export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()

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

      // Enviar progresso a cada 3 segundos por até 10 minutos
      const MAX_ITERACOES = 200
      let iteracoes = 0

      const intervalo = setInterval(async () => {
        iteracoes++

        try {
          // Contagem por status
          const [total, pendente, emProcessamento, concluido, erro] = await Promise.all([
            db.select({ total: count() }).from(fornecedores).where(
              and(eq(fornecedores.empresaId, empresa.id), eq(fornecedores.ativo, true))
            ),
            db.select({ total: count() }).from(fornecedores).where(
              and(eq(fornecedores.empresaId, empresa.id), eq(fornecedores.statusEnriquecimento, 'pendente'))
            ),
            db.select({ total: count() }).from(fornecedores).where(
              and(eq(fornecedores.empresaId, empresa.id), eq(fornecedores.statusEnriquecimento, 'em_processamento'))
            ),
            db.select({ total: count() }).from(fornecedores).where(
              and(eq(fornecedores.empresaId, empresa.id), eq(fornecedores.statusEnriquecimento, 'concluido'))
            ),
            db.select({ total: count() }).from(fornecedores).where(
              and(eq(fornecedores.empresaId, empresa.id), eq(fornecedores.statusEnriquecimento, 'erro'))
            ),
          ])

          const totalN = total[0].total
          const concluidoN = concluido[0].total
          const percentualConcluido = totalN > 0 ? Math.round((concluidoN / totalN) * 100) : 0

          enviar({
            total: totalN,
            pendente: pendente[0].total,
            emProcessamento: emProcessamento[0].total,
            concluido: concluidoN,
            erro: erro[0].total,
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
      }, 3000)

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
