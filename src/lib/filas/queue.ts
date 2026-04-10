import { Queue } from 'bullmq'
import IORedis from 'ioredis'

export function criarConexaoRedis() {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!restUrl || !token) throw new Error('UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN não configurados')

  // Upstash fornece REST URL (https://...) — IORedis precisa de rediss://
  // Extraímos o hostname e montamos a URL Redis padrão
  const hostname = restUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const redisUrl = `rediss://default:${token}@${hostname}:6380`

  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    tls: {},
    lazyConnect: true,
  })
}

export interface JobEnriquecimento {
  cnpj: string
  fornecedorId: string
  empresaId: string
}

// Lazy — só cria a fila quando efetivamente usada
let _filaCnpj: Queue | undefined

function getFilaCnpj(): Queue {
  if (!_filaCnpj) {
    const connection = criarConexaoRedis()
    _filaCnpj = new Queue('enriquecimento-cnpj', {
      connection,
      defaultJobOptions: {
        // Sem pressa: 10 tentativas com backoff exponencial de 5 min.
        // Cronograma aproximado de retentativas por job:
        //   1ª: 5 min   | 2ª: 10 min  | 3ª: 20 min  | 4ª: 40 min
        //   5ª: 80 min  | 6ª: 160 min | 7ª: ~5h     | 8ª: ~11h
        //   9ª: ~21h    | 10ª: ~42h
        // Cobre qualquer indisponibilidade transiente das APIs públicas.
        attempts: 10,
        backoff: { type: 'exponential', delay: 5 * 60 * 1000 }, // 5 min inicial
      },
    })
  }
  return _filaCnpj
}

export async function adicionarNaFila(jobs: JobEnriquecimento[]): Promise<void> {
  const fila = getFilaCnpj()
  const jobsFormatados = jobs.map((j) => ({
    name: 'enriquecer-cnpj',
    data: j,
  }))
  await fila.addBulk(jobsFormatados)
}
