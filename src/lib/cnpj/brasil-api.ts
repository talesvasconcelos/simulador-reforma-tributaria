// Cliente BrasilAPI para consulta de CNPJ

export interface DadosCnpjBrasilApi {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  cnae_fiscal: number
  cnae_fiscal_descricao: string
  cnaes_secundarios?: Array<{ codigo: number; descricao: string }>
  uf: string
  municipio: string
  porte: string
  opcao_pelo_simples: boolean
  opcao_pelo_mei: boolean
  situacao_cadastral: number
  descricao_situacao_cadastral: string
  capital_social: number
  natureza_juridica: string
  descricao_natureza_juridica: string
}

/**
 * Consulta dados de um CNPJ na BrasilAPI.
 * Cache de 24h via Next.js fetch.
 */
export async function consultarCnpjBrasilApi(
  cnpj: string
): Promise<DadosCnpjBrasilApi> {
  const cnpjLimpo = cnpj.replace(/\D/g, '')

  if (cnpjLimpo.length !== 14) {
    throw new Error(`CNPJ inválido: ${cnpj}`)
  }

  const res = await fetch(
    `${process.env.BRASIL_API_URL ?? 'https://brasilapi.com.br/api/cnpj/v1'}/${cnpjLimpo}`,
    {
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 86400 }, // Cache 24h
    } as RequestInit
  )

  if (res.status === 404) {
    throw new Error(`CNPJ não encontrado: ${cnpjLimpo}`)
  }

  if (!res.ok) {
    throw new Error(`BrasilAPI error ${res.status}: ${await res.text()}`)
  }

  return res.json()
}
