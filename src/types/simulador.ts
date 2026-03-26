// Tipos do motor de cálculo tributário

export interface ParamsCalculo {
  ano: number
  regime: string
  setor: string
  faturamentoAnual: number
  aliquotaIcms: number   // % ex: 12 para 12%
  aliquotaIss: number    // % ex: 5 para 5%
  comprasAnuais?: number // base para crédito
  isExportadora?: boolean
}

export interface TributosAtuais {
  pis: number
  cofins: number
  icms: number
  iss: number
  total: number
}

export interface TributosNovos {
  cbs: number
  ibs: number
  isImpSeletivo: number
  total: number
}

export interface CreditosTributarios {
  creditoCbs: number
  creditoIbs: number
  totalCredito: number
  baseCalculo: number
}

export interface ResultadoCalculo {
  ano: number
  regime: string
  setor: string

  // Sistema atual
  tributosAtuais: TributosAtuais

  // Novo sistema (CBS + IBS)
  tributosNovos: TributosNovos

  // Créditos a deduzir
  creditos: CreditosTributarios

  // Carga líquida
  cargaAtual: number
  cargaFutura: number
  variacaoAbsoluta: number
  variacaoPercentual: number

  // Percentuais do cronograma aplicados
  percentualCbsVigente: number
  percentualIbsVigente: number
  percentualIcmsIssRestante: number

  // Mensagem contextual
  alertas: string[]
}

export interface ProjecaoTransicao {
  anos: ResultadoCalculo[]
  menorCarga: number
  maiorCarga: number
  anoMenorCarga: number
  anoMaiorCarga: number
}
