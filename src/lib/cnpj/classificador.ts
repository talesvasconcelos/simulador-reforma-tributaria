// Mapeamento de CNAEs para setores da Reforma Tributária

export type Setor =
  | 'industria'
  | 'comercio_atacado'
  | 'comercio_varejo'
  | 'servicos'
  | 'hotelaria'
  | 'parques_diversao'
  | 'profissionais_liberais'
  | 'servicos_saude'
  | 'servicos_educacao'
  | 'servicos_financeiros'
  | 'fii_fiagro'
  | 'agronegocio'
  | 'construcao_civil'
  | 'construcao_edificios'
  | 'construcao_infraestrutura'
  | 'construcao_servicos_especializados'
  | 'transporte'
  | 'transporte_coletivo_passageiros'
  | 'transporte_cargas'
  | 'imoveis'
  | 'combustiveis_energia'
  | 'telecomunicacoes'
  | 'tecnologia'
  | 'entidades_desportivas'
  | 'entidades_religiosas'
  | 'misto'

// Mapeamento por prefixo CNAE — prefixos mais longos (4 dígitos) têm prioridade
// Referência: CNAE 2.3 — IBGE/Receita Federal
const MAPEAMENTO_CNAE: Array<{ prefixos: string[]; setor: Setor }> = [

  // ── 4 dígitos — mais específicos, verificados primeiro ─────────────────────

  // Transporte coletivo de passageiros urbano/intermunicipal (redução 60%)
  { prefixos: ['4921', '4922', '4929'], setor: 'transporte_coletivo_passageiros' },

  // Transporte de cargas rodoviário (regime geral)
  { prefixos: ['4930'], setor: 'transporte_cargas' },

  // Parques de diversão e parques temáticos — regime hotelaria (Art. 281 LC 214/2025)
  { prefixos: ['9321'], setor: 'parques_diversao' },

  // ── 2 dígitos ──────────────────────────────────────────────────────────────

  // Agronegócio — produtos in natura (CNAE 01–03)
  { prefixos: ['01', '02', '03'], setor: 'agronegocio' },

  // Indústria (CNAE 10–18, 20–33)
  // Nota: 19 = combustíveis/refino → combustiveis_energia; 35 = energia → combustiveis_energia
  {
    prefixos: [
      '10', '11', '12', '13', '14', '15', '16', '17', '18',
      '20', '21', '22', '23', '24', '25', '26', '27', '28', '29',
      '30', '31', '32', '33',
    ],
    setor: 'industria',
  },

  // Combustíveis, refino de petróleo e energia elétrica/gás (regime monofásico)
  { prefixos: ['19', '35'], setor: 'combustiveis_energia' },

  // Construção civil — sub-tipos por divisão CNAE
  { prefixos: ['41'], setor: 'construcao_edificios' },         // Construção de edifícios
  { prefixos: ['42'], setor: 'construcao_infraestrutura' },    // Obras de infraestrutura (rodovias, pontes…)
  { prefixos: ['43'], setor: 'construcao_servicos_especializados' }, // Instalações e acabamentos

  // Comércio de veículos e peças (entre construção e atacado — CNAE 45)
  { prefixos: ['45'], setor: 'comercio_atacado' },

  // Comércio atacado (CNAE 46)
  { prefixos: ['46'], setor: 'comercio_atacado' },

  // Comércio varejo (CNAE 47)
  { prefixos: ['47'], setor: 'comercio_varejo' },

  // Transporte terrestre (CNAE 49) — fallback para tipos não mapeados nos 4 dígitos
  // (ex: táxi CNAE 4923, fretamento 4924 → sem redução definida)
  { prefixos: ['49'], setor: 'transporte_cargas' },

  // Transporte aquaviário, aéreo, auxiliar e correios (CNAE 50–53) — regime geral
  { prefixos: ['50', '51', '52', '53'], setor: 'transporte_cargas' },

  // Hotelaria — regime específico com 40% de redução e vedação de crédito (Arts. 277–283 LC 214/2025)
  { prefixos: ['55'], setor: 'hotelaria' },

  // Alimentação / restaurantes (CNAE 56) — regime padrão sem redução
  { prefixos: ['56'], setor: 'servicos' },

  // Tecnologia / TI (CNAE 58–60, 62–63) — exclui 61 (telecom)
  { prefixos: ['58', '59', '60', '62', '63'], setor: 'tecnologia' },

  // Telecomunicações (CNAE 61) — regime específico diferente de TI
  { prefixos: ['61'], setor: 'telecomunicacoes' },

  // Serviços financeiros (CNAE 64–66)
  { prefixos: ['64', '65', '66'], setor: 'servicos_financeiros' },

  // Atividades imobiliárias (CNAE 68)
  { prefixos: ['68'], setor: 'imoveis' },

  // Profissionais liberais: jurídicos, contabilidade, arquitetura, engenharia, veterinária (CNAE 69–71, 74–75)
  { prefixos: ['69', '70', '71', '74', '75'], setor: 'profissionais_liberais' },

  // Serviços gerais — administração, publicidade, RH, vigilância, limpeza, etc. (CNAE 72–73, 77–82)
  { prefixos: ['57', '72', '73', '77', '78', '79', '80', '81', '82'], setor: 'servicos' },

  // Educação (CNAE 85)
  { prefixos: ['85'], setor: 'servicos_educacao' },

  // Saúde e serviços sociais (CNAE 86–88)
  { prefixos: ['86', '87', '88'], setor: 'servicos_saude' },

  // Atividades desportivas e recreativas (CNAE 93, exceto 9321 = parques) — 60% redução
  { prefixos: ['93'], setor: 'entidades_desportivas' },

  // Atividades de organizações religiosas e entidades associativas (CNAE 94)
  { prefixos: ['94'], setor: 'entidades_religiosas' },

  // Serviços culturais, domésticos e outros (CNAE 90–92, 95–99)
  { prefixos: ['90', '91', '92', '95', '96', '97', '99'], setor: 'servicos' },
]

/**
 * Classifica uma empresa em um setor da Reforma Tributária com base no CNAE principal.
 * Prefixos de 4 dígitos têm prioridade sobre prefixos de 2 dígitos.
 */
export function classificarSetorPorCnae(cnae: string): Setor {
  const cnaeStr = String(cnae).replace(/\D/g, '').padStart(7, '0')
  const prefixo4 = cnaeStr.slice(0, 4)
  const prefixo2 = cnaeStr.slice(0, 2)

  // Primeiro: verificar prefixos de 4 dígitos (mais específicos)
  for (const mapeamento of MAPEAMENTO_CNAE) {
    if (mapeamento.prefixos.some((p) => p.length === 4 && p === prefixo4)) {
      return mapeamento.setor
    }
  }

  // Depois: verificar prefixos de 2 dígitos
  for (const mapeamento of MAPEAMENTO_CNAE) {
    if (mapeamento.prefixos.some((p) => p.length === 2 && p === prefixo2)) {
      return mapeamento.setor
    }
  }

  return 'misto'
}

/**
 * Infere o regime tributário a partir de dados da API de CNPJ.
 * MEI: optante pelo SIMEI → opcaoMei=true OU porte='MEI' (BrasilAPI/ReceitaWS)
 */
export function inferirRegime(dados: {
  opcaoSimples?: boolean
  opcaoMei?: boolean
  capitalSocial?: number
  naturezaJuridica?: string
  porte?: string
}): string {
  const porteMei = dados.porte?.toUpperCase().includes('MEI')
  if (dados.opcaoMei || porteMei) return 'mei'
  if (dados.opcaoSimples) return 'simples_nacional'

  // Pessoas físicas e entidades sem fins lucrativos
  const natureza = dados.naturezaJuridica?.toLowerCase() ?? ''
  if (natureza.includes('associação') || natureza.includes('fundação')) {
    return 'isento'
  }

  // Sem dados suficientes — retornar não identificado
  return 'nao_identificado'
}
