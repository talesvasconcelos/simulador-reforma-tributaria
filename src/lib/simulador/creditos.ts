// Regras de crédito tributário por regime — LC 214/2025
// No sistema CBS+IBS, o crédito é o tributo pago nas entradas

import { CronogramaAno } from './cronograma'
import { calcularAliquotaEfetiva } from './aliquotas'

export interface ParamsCredito {
  regime: string
  comprasAnuais: number          // Valor total das compras/serviços com crédito
  cronograma: CronogramaAno
  setor: string
}

export interface ResultadoCredito {
  creditoCbs: number
  creditoIbs: number
  totalCredito: number
  baseCalculo: number
  percentualEfetivo: number      // % efetivo de crédito sobre compras
  metodologia: string
}

/**
 * Calcula os créditos de CBS e IBS conforme o regime tributário.
 *
 * Lucro Real / Lucro Presumido: crédito integral (não-cumulatividade plena)
 * Simples Nacional / MEI: crédito presumido estimado (~1.5% sobre compras)
 * Isento: sem crédito
 */
export function calcularCreditos(params: ParamsCredito): ResultadoCredito {
  const { regime, comprasAnuais, cronograma, setor } = params

  // 2026: período de teste — CBS/IBS apenas informativo, sem crédito (Art. 359 LC 214/2025)
  if (cronograma.isAnoDeTeste) {
    return {
      creditoCbs: 0,
      creditoIbs: 0,
      totalCredito: 0,
      baseCalculo: comprasAnuais,
      percentualEfetivo: 0,
      metodologia: '2026 — período de teste: CBS/IBS informativos, sem crédito apropriável',
    }
  }

  // Alíquotas efetivas com redução setorial
  const cbsEfetiva = calcularAliquotaEfetiva(cronograma.aliquotaCbs, setor) / 100
  const ibsEfetiva = calcularAliquotaEfetiva(cronograma.aliquotaIbs, setor) / 100
  const percentualIbs = cronograma.percentualIbsVigente / 100

  if (regime === 'lucro_real' || regime === 'lucro_presumido') {
    // Crédito integral — não-cumulatividade plena
    // CBS: crédito pela alíquota CBS nas entradas
    // IBS: crédito proporcional ao percentual vigente no ano
    const creditoCbs = comprasAnuais * cbsEfetiva
    const creditoIbs = comprasAnuais * ibsEfetiva * percentualIbs
    const totalCredito = creditoCbs + creditoIbs
    const percentualEfetivo = comprasAnuais > 0 ? (totalCredito / comprasAnuais) * 100 : 0

    return {
      creditoCbs,
      creditoIbs,
      totalCredito,
      baseCalculo: comprasAnuais,
      percentualEfetivo,
      metodologia: 'Crédito integral (não-cumulatividade plena) — Lucro Real/Presumido',
    }
  }

  if (regime === 'simples_nacional' || regime === 'mei' || regime === 'nanoempreendedor') {
    // Crédito presumido estimado para o tomador do serviço/produto
    // O Simples recolhe CBS+IBS em alíquota diferenciada (não destaca no documento)
    // O adquirente pode apropriar crédito presumido estimado de ~1.5% sobre o valor
    const ALIQUOTA_CREDITO_PRESUMIDO = 0.015 // 1.5% estimado
    const creditoPrimido = comprasAnuais * ALIQUOTA_CREDITO_PRESUMIDO

    return {
      creditoCbs: creditoPrimido * 0.6, // 60% da CBS
      creditoIbs: creditoPrimido * 0.4, // 40% do IBS
      totalCredito: creditoPrimido,
      baseCalculo: comprasAnuais,
      percentualEfetivo: ALIQUOTA_CREDITO_PRESUMIDO * 100,
      metodologia: 'Crédito presumido estimado (~1.5%) — fornecedor Simples Nacional/MEI',
    }
  }

  // Isento ou não identificado: sem crédito
  return {
    creditoCbs: 0,
    creditoIbs: 0,
    totalCredito: 0,
    baseCalculo: comprasAnuais,
    percentualEfetivo: 0,
    metodologia: 'Sem crédito — regime isento ou não identificado',
  }
}
