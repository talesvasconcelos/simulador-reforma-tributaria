import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'fs'
import { config } from 'dotenv'

config({ path: '.env.local' })

const sql = neon(process.env.DATABASE_URL_UNPOOLED)

console.log('Configurando pgvector...')

try {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`
  console.log('✓ Extensão vector ativada')

  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`
  console.log('✓ Extensão uuid-ossp ativada')

  await sql`ALTER TABLE embeddings_rag ADD COLUMN IF NOT EXISTS embedding_vector vector(1024)`
  console.log('✓ Coluna embedding_vector adicionada')

  await sql`
    CREATE INDEX IF NOT EXISTS embeddings_vector_idx
    ON embeddings_rag
    USING ivfflat (embedding_vector vector_cosine_ops)
    WITH (lists = 100)
  `
  console.log('✓ Índice vetorial criado')

  await sql`
    CREATE OR REPLACE FUNCTION buscar_chunks_similares(
      query_embedding vector(1024),
      limite integer DEFAULT 5,
      filtro_setor text DEFAULT NULL
    )
    RETURNS TABLE (
      id uuid,
      conteudo text,
      documento_id uuid,
      similaridade float
    ) AS $$
    BEGIN
      RETURN QUERY
      SELECT
        e.id,
        e.conteudo,
        e.documento_id,
        1 - (e.embedding_vector <=> query_embedding) as similaridade
      FROM embeddings_rag e
      WHERE
        (filtro_setor IS NULL OR e.setor = filtro_setor)
      ORDER BY e.embedding_vector <=> query_embedding
      LIMIT limite;
    END;
    $$ LANGUAGE plpgsql
  `
  console.log('✓ Função buscar_chunks_similares criada')

  console.log('\n✅ pgvector configurado com sucesso!')
} catch (err) {
  console.error('Erro:', err.message)
  process.exit(1)
}
