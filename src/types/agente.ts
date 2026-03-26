import { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { chatHistorico, novidades, documentosRag, embeddingsRag } from '@/lib/db/schema'

export type ChatMensagem = InferSelectModel<typeof chatHistorico>
export type NovaChatMensagem = InferInsertModel<typeof chatHistorico>

export type Novidade = InferSelectModel<typeof novidades>
export type NovaNovidade = InferInsertModel<typeof novidades>

export type DocumentoRag = InferSelectModel<typeof documentosRag>
export type EmbeddingRag = InferSelectModel<typeof embeddingsRag>

export interface ChunkSimilar {
  id: string
  conteudo: string
  documentoId: string
  similaridade: number
  titulo?: string
  fonte?: string
}

export interface ContextoChat {
  empresa: {
    regime: string
    setor: string
    uf: string
    municipio: string
    faturamentoAnual?: string | null
  }
  chunks: ChunkSimilar[]
  historico: Array<{
    role: 'user' | 'assistant'
    conteudo: string
  }>
}

export interface RespostaAgente {
  conteudo: string
  chunksUsados: string[]
  documentosFonte: string[]
  tokens: number
}
