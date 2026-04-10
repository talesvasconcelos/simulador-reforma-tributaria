import { Worker } from 'bullmq'
import { criarConexaoRedis } from './queue'
import { enriquecerCnpj } from '@/lib/ai/agente-cnpj'
import type { JobEnriquecimento } from './queue'

/**
 * Inicializa o worker de enriquecimento de CNPJ.
 * Deve ser chamado em um ambiente de longa duração (não serverless).
 * Em produção na Vercel, use Vercel Functions com max duration ou um servidor separado.
 */
export function iniciarWorkerCnpj() {
  const connection = criarConexaoRedis()

  const worker = new Worker<JobEnriquecimento>(
    'enriquecimento-cnpj',
    async (job) => {
      const { cnpj, fornecedorId } = job.data
      await enriquecerCnpj(cnpj, fornecedorId)
    },
    {
      connection,
      // BrasilAPI: sem rate limit oficial, mas throttling acima de ~5/min.
      // ReceitaWS free: 3 req/min.
      // 2 workers simultâneos + 4/min como teto garante estabilidade para qualquer volume.
      concurrency: 2,
      limiter: {
        max: 4,
        duration: 60000, // 4 req/min
      },
    }
  )

  worker.on('completed', (job) => {
    console.log(`[Worker] CNPJ ${job.data.cnpj} enriquecido com sucesso`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Erro ao enriquecer CNPJ ${job?.data.cnpj}:`, err)
  })

  return worker
}
