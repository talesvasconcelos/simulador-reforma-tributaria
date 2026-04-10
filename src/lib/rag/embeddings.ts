// Geração de embeddings via Voyage AI — voyage-law-2 (especializado em textos jurídicos)

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const MODELO_EMBEDDING = 'voyage-law-2'

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function chamarVoyageAI(input: string[], tentativa = 1): Promise<{ data: { embedding: number[] }[] }> {
  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input, model: MODELO_EMBEDDING }),
  })

  if (res.status === 429 && tentativa <= 5) {
    // Rate limit: aguardar 20s e tentar novamente (3 RPM = 1 req a cada 20s)
    const espera = 20000 * tentativa
    console.log(`[embeddings] Rate limit 429, aguardando ${espera / 1000}s (tentativa ${tentativa}/5)`)
    await sleep(espera)
    return chamarVoyageAI(input, tentativa + 1)
  }

  if (!res.ok) {
    const erro = await res.text()
    throw new Error(`Voyage AI error ${res.status}: ${erro}`)
  }

  return res.json()
}

export async function gerarEmbedding(texto: string): Promise<number[]> {
  const dados = await chamarVoyageAI([texto])
  return dados.data[0].embedding
}

export async function gerarEmbeddingsLote(textos: string[]): Promise<number[][]> {
  const dados = await chamarVoyageAI(textos)
  return dados.data.map((d) => d.embedding)
}
