import { db } from '@/lib/db'
import { documentosRag } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { gerarEmbedding } from './embeddings'
import type { ChunkSimilar } from '@/types/agente'

/**
 * Busca chunks semanticamente similares a uma pergunta.
 * Usa a função SQL buscar_chunks_similares criada via pgvector.
 */
export async function buscarChunksSimilares(
  pergunta: string,
  limite = 5,
  filtroSetor?: string
): Promise<ChunkSimilar[]> {
  // 1. Gerar embedding da pergunta
  const embedding = await gerarEmbedding(pergunta)
  const embeddingStr = JSON.stringify(embedding)

  // 2. Chamar função SQL de busca semântica (criada manualmente no Neon)
  const resultado = await db.execute(
    sql`SELECT
          e.id,
          e.conteudo,
          e.documento_id,
          1 - (e.embedding_vector <=> ${embeddingStr}::vector) as similaridade,
          d.titulo,
          d.fonte
        FROM embeddings_rag e
        JOIN documentos_rag d ON d.id = e.documento_id
        WHERE
          e.embedding_vector IS NOT NULL
          AND (${filtroSetor ?? null}::text IS NULL OR e.setor = ${filtroSetor ?? null})
        ORDER BY e.embedding_vector <=> ${embeddingStr}::vector
        LIMIT ${limite}`
  )

  return (resultado.rows as Array<{
    id: string
    conteudo: string
    documento_id: string
    similaridade: number
    titulo: string
    fonte: string
  }>).map((row) => ({
    id: row.id,
    conteudo: row.conteudo,
    documentoId: row.documento_id,
    similaridade: row.similaridade,
    titulo: row.titulo,
    fonte: row.fonte,
  }))
}
