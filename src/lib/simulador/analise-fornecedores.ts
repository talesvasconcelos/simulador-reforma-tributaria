// Análise estratégica de compras — impacto da Reforma no custo efetivo por fornecedor

import { CRONOGRAMA_TRANSICAO } from './cronograma'
import { calcularAliquotaEfetiva, ALIQUOTAS_SETORIAIS } from './aliquotas'
import type { AnaliseEstrategica } from '@/types/fornecedor'

export interface ParamsAnalise {
  fornecedorId: string
  cnpj: string
  nome: string
  regime: string
  setor: string
  precoMedioMensal: number       // Valor médio mensal de compras deste fornecedor
  setorComprador: string          // Setor da empresa compradora
  regimeComprador: string         // Regime da empresa compradora
  ano: number
  opcaoCbsIbsPorFora?: boolean   // Simples que recolhe CBS/IBS fora do DAS → crédito integral
}

/**
 * Calcula o custo efetivo de compra de um fornecedor considerando os créditos
 * que o comprador pode apropriar no sistema CBS+IBS.
 *
 * Exemplo:
 * - Fornecedor Lucro Real, R$1.000: crédito 8.8% = R$88 → custo efetivo R$912
 * - Fornecedor Simples, R$950: crédito 1.5% = R$14 → custo efetivo R$936
 * → O Simples é MAIS CARO apesar do preço nominal menor
 */
export function calcularCustoEfetivo(params: ParamsAnalise): AnaliseEstrategica {
  const {
    fornecedorId,
    cnpj,
    nome,
    regime,
    setor,
    precoMedioMensal,
    regimeComprador,
    ano,
    opcaoCbsIbsPorFora = false,
  } = params

  const cronograma = CRONOGRAMA_TRANSICAO[ano] ?? CRONOGRAMA_TRANSICAO[2027]

  if (precoMedioMensal <= 0) {
    return {
      fornecedorId, cnpj, nome, regime, setor,
      precoMedioMensal: 0,
      percentualCredito: 0,
      creditoMensal: 0,
      creditoPotencialMensal: 0,
      custoEfetivo: 0,
      economia: 0,
      recomendacao: 'avaliar_substituto' as const,
      creditoVedado: false,
    }
  }

  // Somente Lucro Real/Presumido pode apropriar crédito integral
  const podeApropriarCredito =
    regimeComprador === 'lucro_real' || regimeComprador === 'lucro_presumido'

  let percentualCredito = 0
  let creditoMensal = 0

  // Art. 283 LC 214/2025 — setores com crédito vedado ao comprador (ex.: hotelaria, parques)
  const configSetor = ALIQUOTAS_SETORIAIS[setor]
  const creditoVedado = configSetor?.creditoVedado === true

  // 2026: período de teste — CBS/IBS apenas informativo, sem pagamento e sem crédito (Art. 359 LC 214/2025)
  if (cronograma.isAnoDeTeste) {
    return {
      fornecedorId, cnpj, nome, regime, setor,
      precoMedioMensal,
      percentualCredito: 0,
      creditoMensal: 0,
      creditoPotencialMensal: 0,
      custoEfetivo: precoMedioMensal,
      economia: 0,
      recomendacao: 'avaliar_substituto' as const,
      creditoVedado: false,
    }
  }

  const ehSimples = regime === 'simples_nacional' || regime === 'mei' || regime === 'nanoempreendedor'
  const geraCreditoIntegral = regime === 'lucro_real' || regime === 'lucro_presumido' || (ehSimples && opcaoCbsIbsPorFora)

  // Crédito potencial: o que o comprador obteria se fosse Lucro Real/Presumido
  // Usado para mostrar o "crédito perdido" quando o comprador não pode apropriar
  let creditoPotencialMensal = 0
  if (!creditoVedado) {
    if (geraCreditoIntegral) {
      const cbsEfetiva = calcularAliquotaEfetiva(cronograma.aliquotaCbs, setor) / 100
      const ibsEfetiva = calcularAliquotaEfetiva(cronograma.aliquotaIbs, setor) / 100
      const percentualIbs = cronograma.percentualIbsVigente / 100
      creditoPotencialMensal = precoMedioMensal * (cbsEfetiva + ibsEfetiva * percentualIbs)
    } else if (ehSimples) {
      // MEI: crédito presumido 0.5% | Simples Nacional: 1.5% (crédito presumido CBS)
      const taxaPresumida = regime === 'mei' ? 0.005 : 0.015
      creditoPotencialMensal = precoMedioMensal * taxaPresumida
    }
  }

  if (podeApropriarCredito && !creditoVedado) {
    if (geraCreditoIntegral) {
      // Lucro Real/Presumido OU Simples com opção CBS/IBS por fora → crédito integral
      const cbsEfetiva = calcularAliquotaEfetiva(cronograma.aliquotaCbs, setor) / 100
      const ibsEfetiva = calcularAliquotaEfetiva(cronograma.aliquotaIbs, setor) / 100
      const percentualIbs = cronograma.percentualIbsVigente / 100

      percentualCredito = cbsEfetiva + ibsEfetiva * percentualIbs
      creditoMensal = precoMedioMensal * percentualCredito
    } else if (ehSimples) {
      // MEI: crédito presumido 0.5% | Simples Nacional: 1.5% (alinha com percentualCreditoEstimado do DB)
      percentualCredito = regime === 'mei' ? 0.005 : 0.015
      creditoMensal = precoMedioMensal * percentualCredito
    }
    // Isento: sem crédito transferível
  }

  const custoEfetivo = precoMedioMensal - creditoMensal
  const economia = creditoMensal

  // Classificação da recomendação
  const ratioCustoEfetivo = custoEfetivo / precoMedioMensal
  let recomendacao: 'manter' | 'renegociar' | 'avaliar_substituto'

  if (creditoVedado) {
    // Setor com crédito vedado em lei — custo efetivo = preço cheio, sempre avaliar
    recomendacao = 'avaliar_substituto'
  } else if (ratioCustoEfetivo < 0.95) {
    // Crédito > 5% — fornecedor é vantajoso
    recomendacao = 'manter'
  } else if (ratioCustoEfetivo <= 1.0) {
    // Crédito < 5% — renegociar ou buscar alternativa Lucro Real
    recomendacao = 'renegociar'
  } else {
    // Sem crédito ou custo efetivo maior que o preço — avaliar substituto
    recomendacao = 'avaliar_substituto'
  }

  return {
    fornecedorId,
    cnpj,
    nome,
    regime,
    setor,
    precoMedioMensal,
    percentualCredito: percentualCredito * 100,
    creditoMensal,
    creditoPotencialMensal,
    custoEfetivo,
    economia,
    recomendacao,
    creditoVedado,
  }
}

/**
 * Projeta a economia anual acumulada com os créditos de todos os fornecedores.
 */
export function projetarEconomiaAnual(
  fornecedores: Array<ParamsAnalise>,
): Record<number, number> {
  const anos = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]
  const resultado: Record<number, number> = {}

  for (const ano of anos) {
    const totalEconomia = fornecedores.reduce((acc, f) => {
      const analise = calcularCustoEfetivo({ ...f, ano })
      return acc + analise.creditoMensal * 12 // anualizar
    }, 0)
    resultado[ano] = totalEconomia
  }

  return resultado
}
