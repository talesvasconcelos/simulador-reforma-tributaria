import { Queue } from 'bullmq'
import IORedis from 'ioredis'

// Conexão Upstash Redis via IORedis
export function criarConexaoRedis() {
  return new IORedis(process.env.UPSTASH_REDIS_REST_URL!, {
    password: process.env.UPSTASH_REDIS_REST_TOKEN,
    maxRetriesPerRequest: null,
    tls: process.env.UPSTASH_REDIS_REST_URL?.startsWith('rediss://') ? {} : undefined,
  })
}

const connection = criarConexaoRedis()

export const filaCnpj = new Queue('enriquecimento-cnpj', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 }, // 1min, 2min, 4min
  },
})

export interface JobEnriquecimento {
  cnpj: string
  fornecedorId: string
  empresaId: string
}

export async function adicionarNaFila(jobs: JobEnriquecimento[]): Promise<void> {
  const jobsFormatados = jobs.map((j) => ({
    name: 'enriquecer-cnpj',
    data: j,
  }))

  await filaCnpj.addBulk(jobsFormatados)
}
