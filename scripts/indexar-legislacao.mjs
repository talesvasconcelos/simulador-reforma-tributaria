/**
 * Script para indexar a base legal da Reforma Tributária no pgvector.
 * Executa diretamente (sem passar pela API HTTP) para evitar timeout.
 *
 * Uso: node scripts/indexar-legislacao.mjs
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

config({ path: '.env.local' })

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ─── Chunker simples (sem LangChain para manter como script MJS) ──────────────
function dividirEmChunks(texto, tamanho = 800, overlap = 100) {
  const chunks = []
  let inicio = 0

  while (inicio < texto.length) {
    const fim = Math.min(inicio + tamanho, texto.length)
    const chunk = texto.slice(inicio, fim)
    if (chunk.trim().length >= 50) {
      chunks.push(chunk.trim())
    }
    inicio += tamanho - overlap
  }

  return chunks
}

// ─── Voyage AI ────────────────────────────────────────────────────────────────
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function gerarEmbeddingsLote(textos, tentativa = 1) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input: textos, model: 'voyage-law-2' }),
  })

  if (res.status === 429 && tentativa <= 8) {
    const espera = 21000 * tentativa
    console.log(`  ⏳ Rate limit 429, aguardando ${espera / 1000}s (tentativa ${tentativa}/8)`)
    await sleep(espera)
    return gerarEmbeddingsLote(textos, tentativa + 1)
  }

  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`Voyage AI ${res.status}: ${erro}`)
  }

  const dados = await res.json()
  return dados.data.map((d) => d.embedding)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const docPath = join(ROOT, '../Docs/reforma_tributaria_brasil_documentacao_completa.md')

if (!existsSync(docPath)) {
  console.error('❌ Arquivo não encontrado:', docPath)
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL_UNPOOLED)
const db = drizzle(sql)

console.log('📖 Lendo arquivo da legislação...')
const conteudo = readFileSync(docPath, 'utf-8')
console.log(`   ${conteudo.length.toLocaleString()} caracteres`)

const chunks = dividirEmChunks(conteudo)
console.log(`✂️  ${chunks.length} chunks gerados (800 chars cada)`)

// Verificar se já foi indexado
const existentes = await sql`SELECT COUNT(*) as total FROM documentos_rag WHERE fonte = 'LC 214/2025 + EC 132/2023'`
if (Number(existentes[0].total) > 0) {
  console.log('ℹ️  Documento já indexado. Para reindexar, delete os registros existentes primeiro.')
  console.log(`   Documentos encontrados: ${existentes[0].total}`)
  process.exit(0)
}

// Inserir documento
const [{ id: documentoId }] = await sql`
  INSERT INTO documentos_rag (titulo, fonte, tipo_documento, data_publicacao, total_chunks)
  VALUES (
    'Documentação Completa — Reforma Tributária Brasileira (LC 214/2025)',
    'LC 214/2025 + EC 132/2023',
    'lei',
    '2025-01-10',
    ${chunks.length}
  )
  RETURNING id
`
console.log(`\n📄 Documento registrado: ${documentoId}`)
console.log(`\n🔢 Indexando ${chunks.length} chunks (lotes de 10, ~20s entre lotes no free tier)...\n`)

const TAMANHO_LOTE = 10
let processados = 0

for (let i = 0; i < chunks.length; i += TAMANHO_LOTE) {
  const lote = chunks.slice(i, i + TAMANHO_LOTE)
  const loteNum = Math.floor(i / TAMANHO_LOTE) + 1
  const totalLotes = Math.ceil(chunks.length / TAMANHO_LOTE)

  process.stdout.write(`  Lote ${loteNum}/${totalLotes} (chunks ${i + 1}–${Math.min(i + TAMANHO_LOTE, chunks.length)})... `)

  const embeddings = await gerarEmbeddingsLote(lote)

  for (let j = 0; j < lote.length; j++) {
    const chunk = lote[j]
    const embedding = embeddings[j]

    // Extrair artigos mencionados
    const artigos = [...new Set((chunk.match(/Art\.?\s*\d+[°º]?(?:-[A-Z])?/gi) ?? []).map((m) => m.trim()))]

    // Termos tributários presentes
    const termosTributarios = ['CBS','IBS','IS','PIS','COFINS','ICMS','ISS','IPI','Simples Nacional','Lucro Real','Lucro Presumido','MEI','alíquota','crédito','isenção','redução','LC 214','EC 132']
    const palavrasChave = termosTributarios.filter((t) => chunk.toUpperCase().includes(t.toUpperCase()))

    const [{ id: embeddingId }] = await sql`
      INSERT INTO embeddings_rag (documento_id, chunk_index, conteudo, embedding, artigos, palavras_chave)
      VALUES (
        ${documentoId},
        ${i + j},
        ${chunk},
        ${JSON.stringify(embedding)},
        ${JSON.stringify(artigos)}::jsonb,
        ${JSON.stringify(palavrasChave)}::jsonb
      )
      RETURNING id
    `

    // Atualizar coluna vetorial pgvector
    await sql`
      UPDATE embeddings_rag
      SET embedding_vector = ${JSON.stringify(embedding)}::vector
      WHERE id = ${embeddingId}
    `

    processados++
  }

  console.log('✓')

  // Aguardar 21s entre lotes para respeitar 3 RPM
  if (i + TAMANHO_LOTE < chunks.length) {
    process.stdout.write(`  ⏳ Aguardando 21s (rate limit)...`)
    await sleep(21000)
    console.log(' ok')
  }
}

console.log(`\n✅ Indexação concluída! ${processados} chunks indexados.`)
console.log(`   Documento ID: ${documentoId}`)
