import { db } from '@/lib/db'
import { documentosRag, embeddingsRag } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { dividirEmChunks, extrairArtigos, extrairPalavrasChave } from './chunker'
import { gerarEmbeddingsLote } from './embeddings'

interface ParamsIndexacao {
  titulo: string
  fonte: string
  conteudo: string
  tipoDocumento?: string
  url?: string
  dataPublicacao?: Date
}

/**
 * Indexa um documento jurídico: divide em chunks, gera embeddings e salva no banco.
 */
export async function indexarDocumento(params: ParamsIndexacao): Promise<string> {
  const { titulo, fonte, conteudo, tipoDocumento, url, dataPublicacao } = params

  // 1. Criar registro do documento
  const [documento] = await db
    .insert(documentosRag)
    .values({
      titulo,
      fonte,
      url,
      tipoDocumento,
      dataPublicacao,
      totalChunks: 0,
    })
    .returning({ id: documentosRag.id })

  const documentoId = documento.id

  try {
    // 2. Dividir em chunks
    const chunks = await dividirEmChunks(conteudo)

    // 3. Gerar embeddings em lote — free tier: 3 RPM, 10K TPM → máx ~10 chunks por lote
    const TAMANHO_LOTE = 10
    let chunkIndex = 0

    for (let i = 0; i < chunks.length; i += TAMANHO_LOTE) {
      const lote = chunks.slice(i, i + TAMANHO_LOTE)
      const embeddings = await gerarEmbeddingsLote(lote)

      // 4. Salvar chunks e embeddings no banco
      for (let j = 0; j < lote.length; j++) {
        const chunk = lote[j]
        const embedding = embeddings[j]
        const artigos = extrairArtigos(chunk)
        const palavrasChave = extrairPalavrasChave(chunk)

        const [embeddingRecord] = await db
          .insert(embeddingsRag)
          .values({
            documentoId,
            chunkIndex: chunkIndex++,
            conteudo: chunk,
            embedding: JSON.stringify(embedding),
            artigos,
            palavrasChave,
          })
          .returning({ id: embeddingsRag.id })

        // 5. Atualizar a coluna vetorial via SQL raw (pgvector)
        await db.execute(
          sql`UPDATE embeddings_rag
              SET embedding_vector = ${JSON.stringify(embedding)}::vector
              WHERE id = ${embeddingRecord.id}`
        )
      }
    }

    // 6. Atualizar total de chunks no documento
    await db
      .update(documentosRag)
      .set({ totalChunks: chunkIndex })
      .where(eq(documentosRag.id, documentoId))

    return documentoId
  } catch (error) {
    // Remover documento em caso de erro
    await db.delete(documentosRag).where(eq(documentosRag.id, documentoId))
    throw error
  }
}
