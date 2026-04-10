// Cliente ReceitaWS — fallback para BrasilAPI
// Rate limit: 3 req/min no plano gratuito
// O controle de taxa é feito pelo BullMQ limiter no worker — não adicionar delay aqui.

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
  mei: { optante: boolean } | null    // campo legado (algumas versões)
  simei: { optante: boolean } | null  // campo atual da ReceitaWS para MEI/SIMEI
}

/**
 * Consulta dados de um CNPJ na ReceitaWS.
 * Usar apenas como fallback da BrasilAPI.
 *
 * @param respeitarRateLimit - Legado: mantido para compatibilidade, não tem efeito.
 *   A taxa de chamadas é controlada pelo BullMQ limiter no worker.
 */
export async function consultarCnpjReceitaWS(
  cnpj: string,
  respeitarRateLimit = true, // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<DadosCnpjReceitaWS> {
  const cnpjLimpo = cnpj.replace(/\D/g, '')

  if (cnpjLimpo.length !== 14) {
    throw new Error(`CNPJ inválido: ${cnpj}`)
  }

  const res = await fetch(
    `${process.env.RECEITA_WS_URL ?? 'https://www.receitaws.com.br/v1/cnpj'}/${cnpjLimpo}`,
    {
      signal: AbortSignal.timeout(15000),
    }
  )

  if (res.status === 429) {
    throw new Error(`ReceitaWS rate limit (429) — job será retentado pelo BullMQ`)
  }

  if (!res.ok) {
    throw new Error(`ReceitaWS error ${res.status}: ${await res.text()}`)
  }

  const dados = await res.json()

  if (dados.status === 'ERROR') {
    throw new Error(`ReceitaWS: ${dados.message ?? 'CNPJ não encontrado'}`)
  }

  return dados
}
