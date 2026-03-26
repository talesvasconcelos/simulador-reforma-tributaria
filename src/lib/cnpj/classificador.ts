// Mapeamento de CNAEs para setores da Reforma Tributária

type Setor =
  | 'industria'
  | 'comercio_atacado'
  | 'comercio_varejo'
  | 'servicos'
  | 'servicos_saude'
  | 'servicos_educacao'
  | 'servicos_financeiros'
  | 'agronegocio'
  | 'construcao_civil'
  | 'transporte'
  | 'tecnologia'
  | 'misto'

// Prefixos CNAE por divisão/grupo IBGE
const MAPEAMENTO_CNAE: Array<{ prefixos: string[]; setor: Setor }> = [
  // Agronegócio (CNAE 01-09)
  { prefixos: ['01', '02', '03'], setor: 'agronegocio' },

  // Indústria (CNAE 10-33)
  { prefixos: ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19',
               '20', '21', '22', '23', '24', '25', '26', '27', '28', '29',
               '30', '31', '32', '33'], setor: 'industria' },

  // Construção civil (CNAE 41-43)
  { prefixos: ['41', '42', '43'], setor: 'construcao_civil' },

  // Comércio atacado (CNAE 46)
  { prefixos: ['46'], setor: 'comercio_atacado' },

  // Comércio varejo (CNAE 47)
  { prefixos: ['47'], setor: 'comercio_varejo' },

  // Transporte (CNAE 49-53)
  { prefixos: ['49', '50', '51', '52', '53'], setor: 'transporte' },

  // Serviços financeiros (CNAE 64-66)
  { prefixos: ['64', '65', '66'], setor: 'servicos_financeiros' },

  // Tecnologia / TI (CNAE 58-63)
  { prefixos: ['58', '59', '60', '61', '62', '63'], setor: 'tecnologia' },

  // Educação (CNAE 85)
  { prefixos: ['85'], setor: 'servicos_educacao' },

  // Saúde (CNAE 86-88)
  { prefixos: ['86', '87', '88'], setor: 'servicos_saude' },

  // Serviços gerais (CNAE 55-57, 68-82, 90-99)
  { prefixos: ['55', '56', '57', '68', '69', '70', '71', '72', '73',
               '74', '75', '77', '78', '79', '80', '81', '82', '90',
               '91', '92', '93', '94', '95', '96', '97', '99'], setor: 'servicos' },
]

/**
 * Classifica uma empresa em um setor da Reforma Tributária com base no CNAE principal.
 */
export function classificarSetorPorCnae(cnae: string): Setor {
  const cnaeStr = String(cnae).padStart(7, '0')
  const prefixo2 = cnaeStr.slice(0, 2)

  for (const mapeamento of MAPEAMENTO_CNAE) {
    if (mapeamento.prefixos.includes(prefixo2)) {
      return mapeamento.setor
    }
  }

  return 'misto'
}

/**
 * Infere o regime tributário a partir de dados da API de CNPJ.
 */
export function inferirRegime(dados: {
  opcaoSimples?: boolean
  opcaoMei?: boolean
  capitalSocial?: number
  naturezaJuridica?: string
}): string {
  if (dados.opcaoMei) return 'mei'
  if (dados.opcaoSimples) return 'simples_nacional'

  // Pessoas físicas e entidades sem fins lucrativos
  const natureza = dados.naturezaJuridica?.toLowerCase() ?? ''
  if (natureza.includes('associação') || natureza.includes('fundação')) {
    return 'isento'
  }

  // Sem dados suficientes — retornar não identificado
  return 'nao_identificado'
}
