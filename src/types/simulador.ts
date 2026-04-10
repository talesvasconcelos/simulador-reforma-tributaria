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
  /**
   * Regime PIS/COFINS antes de 2027 — apenas para referência histórica no comparativo.
   * cumulativo:     PIS 0,65% + COFINS 3,00% = 3,65% (Lucro Presumido padrão — Lei 9.718/98)
   * nao_cumulativo: PIS 1,65% + COFINS 7,60% = 9,25% (Lucro Real e LP opcional — Lei 10.637/02)
   * A partir de 2027 todos vão para CBS 8,8% — sem escolha.
   */
  pisCofinsRegime?: 'cumulativo' | 'nao_cumulativo'
}

/**
 * Comparativo informativo PIS/COFINS (antes de 2027) vs CBS 8,8% (a partir de 2027).
 * Mostra o impacto da reforma para quem era cumulativo ou não-cumulativo.
 * A CBS 8,8% é obrigatória para todos (Lucro Real e Presumido) a partir de 2027 — sem opção.
 */
export interface ComparativoCbsPresumido {
  cbsLiquido: number               // CBS 8,8% com crédito — mesmo valor para ambos os cenários
  creditoAproveitado: number
  cbsBruto: number
  comprasFaturamentoRatio: number

  // Referência: quem era PIS/COFINS cumulativo (3,65%) antes de 2027
  seCumulativo: {
    pisCofinsAntes: number         // 3,65% × faturamento
    variacaoAbsoluta: number       // CBS líquido - PIS/COFINS cumulativo
    variacaoPercentual: number
    impacto: 'aumento' | 'reducao' | 'neutro'
  }

  // Referência: quem era PIS/COFINS não-cumulativo (9,25% com crédito) antes de 2027
  seNaoCumulativo: {
    pisCofinsAntes: number         // 9,25% × faturamento (bruto, sem crédito de entrada)
    pisCofinsLiquidoAntes: number  // Após crédito de entradas (PIS/COFINS não-cumulativo já tinha crédito)
    variacaoAbsoluta: number       // CBS líquido - PIS/COFINS não-cumulativo líquido
    variacaoPercentual: number
    impacto: 'aumento' | 'reducao' | 'neutro'
  }
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

  /** Somente para Lucro Presumido — comparativo cumulativo vs não-cumulativo CBS */
  comparativoCbs?: ComparativoCbsPresumido
}

export interface ProjecaoTransicao {
  anos: ResultadoCalculo[]
  menorCarga: number
  maiorCarga: number
  anoMenorCarga: number
  anoMaiorCarga: number
}
