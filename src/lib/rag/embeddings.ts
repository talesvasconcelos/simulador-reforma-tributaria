// Geração de embeddings via Voyage AI — voyage-law-2 (especializado em textos jurídicos)

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const MODELO_EMBEDDING = 'voyage-law-2'

export async function gerarEmbedding(texto: string): Promise<number[]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: [texto],
      model: MODELO_EMBEDDING,
    }),
  })

  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`Voyage AI error ${res.status}: ${erro}`)
  }

  const dados = await res.json()
  return dados.data[0].embedding as number[]
}

export async function gerarEmbeddingsLote(textos: string[]): Promise<number[][]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: textos,
      model: MODELO_EMBEDDING,
    }),
  })

  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`Voyage AI error ${res.status}: ${erro}`)
  }

  const dados = await res.json()
  return dados.data.map((d: { embedding: number[] }) => d.embedding)
}
