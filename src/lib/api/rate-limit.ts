/**
 * Rate limiter simples usando Upstash Redis REST API.
 * Não requer pacotes extras — usa fetch direto.
 * Estratégia: janela fixa (fixed window) com INCR + EXPIRE.
 *
 * Se o Redis não estiver configurado ou falhar, permite a requisição passar
 * (fail-open) para não derrubar o sistema por problema de infraestrutura.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!restUrl || !token) {
    // Redis não configurado — permite passar
    return { allowed: true, remaining: limit }
  }

  try {
    const windowKey = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSeconds)}`

    const res = await fetch(`${restUrl}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', windowKey],
        ['EXPIRE', windowKey, windowSeconds],
      ]),
      signal: AbortSignal.timeout(2000), // não bloqueia mais de 2s
    })

    if (!res.ok) return { allowed: true, remaining: limit }

    // Upstash pipeline response: [{"result": N}, {"result": N}]
    const data = await res.json() as Array<{ result: number }>
    const count = data[0]?.result ?? 0
    const remaining = Math.max(0, limit - count)
    return { allowed: count <= limit, remaining }
  } catch {
    // Redis indisponível — fail-open
    return { allowed: true, remaining: limit }
  }
}
