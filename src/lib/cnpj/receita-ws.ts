// Cliente ReceitaWS — fallback para BrasilAPI
// Rate limit: 3 req/min no plano gratuito

export interface DadosCnpjReceitaWS {
  status: string
  ultima_atualizacao: string
  cnpj: string
  tipo: string
  porte: string
  nome: string
  fantasia: string
  abertura: string
  atividade_principal: Array<{ code: string; text: string }>
  atividades_secundarias: Array<{ code: string; text: string }>
  natureza_juridica: string
  logradouro: string
  numero: string
  municipio: string
  bairro: string
  uf: string
  cep: string
  telefone: string
  email: string
  situacao: string
  data_situacao: string
  capital_social: string
  simples: { optante: boolean; data_opcao: string; data_exclusao: string } | null
  mei: { optante: boolean } | null
}

/**
 * Consulta dados de um CNPJ na ReceitaWS.
 * Usar apenas como fallback da BrasilAPI.
 * Respeita o rate limit de 3 req/min com delay de 20s.
 */
export async function consultarCnpjReceitaWS(
  cnpj: string,
  respeitarRateLimit = true
): Promise<DadosCnpjReceitaWS> {
  const cnpjLimpo = cnpj.replace(/\D/g, '')

  if (cnpjLimpo.length !== 14) {
    throw new Error(`CNPJ inválido: ${cnpj}`)
  }

  // Rate limit: aguardar antes da chamada
  if (respeitarRateLimit) {
    await new Promise((r) => setTimeout(r, 20000))
  }

  const res = await fetch(
    `${process.env.RECEITA_WS_URL ?? 'https://www.receitaws.com.br/v1/cnpj'}/${cnpjLimpo}`,
    {
      signal: AbortSignal.timeout(15000),
    }
  )

  if (!res.ok) {
    throw new Error(`ReceitaWS error ${res.status}: ${await res.text()}`)
  }

  const dados = await res.json()

  if (dados.status === 'ERROR') {
    throw new Error(`ReceitaWS: ${dados.message}`)
  }

  return dados
}
