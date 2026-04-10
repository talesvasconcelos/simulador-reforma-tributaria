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
   * Regime PIS/COFINS — relevante apenas para Lucro Presumido.
   * cumulativo:     PIS 0,65% + COFINS 3,00% = 3,65% (sem crédito)
   * nao_cumulativo: PIS 1,65% + COFINS 7,60% = 9,25% (com crédito)
   * Lucro Real é sempre não-cumulativo.
   */
  pisCofinsRegime?: 'cumulativo' | 'nao_cumulativo'
}

/** Comparativo entre as duas opções de CBS para Lucro Presumido (LC 214/2025) */
export interface ComparativoCbsPresumido {
  pontoEquilibrio: number          // % compras/faturamento onde as opções emparam
  comprasFaturamentoRatio: number  // % compras/faturamento da empresa
  opcaoCumulativa: {
    pisCofinsAtual: number         // carga PIS/COFINS atual (3,65%)
    cbsFuturo: number              // CBS 3,65% sem crédito
    variacaoAbsoluta: number
    variacaoPercentual: number
  }
  opcaoNaoCumulativa: {
    pisCofinsAtual: number         // carga PIS/COFINS atual (9,25%) — se migrasse
    cbsBruto: number               // CBS 8,8%
    creditoAproveitado: number
    cbsLiquido: number
    variacaoVsAtualCumulativo: number  // vs carga cumulativa atual (comparação justa)
    variacaoPercentualVsAtual: number
  }
  recomendacao: 'manter_cumulativo' | 'migrar_nao_cumulativo'
  economiaAnualComMigracao: number  // positivo = migrar é melhor
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
