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
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 60000, // 10 req/min para respeitar rate limits das APIs
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
