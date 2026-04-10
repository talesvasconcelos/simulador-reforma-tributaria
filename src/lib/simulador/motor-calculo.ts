// Motor principal de cálculo do impacto tributário — Reforma Tributária 2024
// Lei Complementar 214/2025 — CBS, IBS, IS substituindo PIS/COFINS, ICMS, ISS

import { CRONOGRAMA_TRANSICAO, ANOS_TRANSICAO } from './cronograma'
import { ALIQUOTAS_SETORIAIS, calcularAliquotaEfetiva } from './aliquotas'
import { calcularCreditos } from './creditos'
import type {
  ParamsCalculo,
  ResultadoCalculo,
  TributosAtuais,
  TributosNovos,
  ProjecaoTransicao,
  ComparativoCbsPresumido,
} from '@/types/simulador'

// Alíquotas PIS/COFINS — regime não-cumulativo (Lucro Real / Lucro Presumido opcional)
const ALIQUOTA_PIS_NAO_CUMULATIVO = 0.0165   // 1,65%
const ALIQUOTA_COFINS_NAO_CUMULATIVO = 0.076  // 7,60%
const ALIQUOTA_PIS_COFINS_NAO_CUMULATIVO = ALIQUOTA_PIS_NAO_CUMULATIVO + ALIQUOTA_COFINS_NAO_CUMULATIVO // 9,25%

// Alíquotas PIS/COFINS — regime cumulativo (Lucro Presumido padrão — Lei 9.718/98)
const ALIQUOTA_PIS_CUMULATIVO = 0.0065   // 0,65%
const ALIQUOTA_COFINS_CUMULATIVO = 0.030  // 3,00%
const ALIQUOTA_PIS_COFINS_CUMULATIVO = ALIQUOTA_PIS_CUMULATIVO + ALIQUOTA_COFINS_CUMULATIVO // 3,65%


/**
 * Calcula o impacto tributário para um determinado ano da transição.
 */
export function calcularImpacto(params: ParamsCalculo): ResultadoCalculo {
  const {
    ano,
    regime,
    setor,
    faturamentoAnual,
    aliquotaIcms,
    aliquotaIss,
    comprasAnuais = faturamentoAnual * 0.4, // 40% de compras como default
    isExportadora = false,
    pisCofinsRegime: pisCofinsRegimeParam,
  } = params

  // Lucro Presumido: cumulativo por padrão (Lei 9.718/98 — maioria das empresas)
  // Lucro Real: sempre não-cumulativo
  const pisCofinsRegime = regime === 'lucro_real'
    ? 'nao_cumulativo'
    : regime === 'lucro_presumido'
      ? (pisCofinsRegimeParam ?? 'cumulativo')
      : 'nao_cumulativo' // outros regimes não destacam PIS/COFINS

  const cronograma = CRONOGRAMA_TRANSICAO[ano]
  if (!cronograma) {
    throw new Error(`Ano ${ano} não está no cronograma de transição (2026–2033)`)
  }

  const configSetor = ALIQUOTAS_SETORIAIS[setor] ?? ALIQUOTAS_SETORIAIS.misto
  const alertas: string[] = []

  // ============================================================
  // 1. SISTEMA ATUAL (PIS/COFINS + ICMS + ISS)
  // ============================================================

  let pisCofinsAtual = 0
  let aliquotaPisCofinsUsada = 0

  if (!cronograma.pisCofinExtinto) {
    if (regime === 'simples_nacional' || regime === 'mei' || regime === 'nanoempreendedor') {
      pisCofinsAtual = 0 // já embutido no DAS
    } else if (regime === 'isento') {
      pisCofinsAtual = 0
    } else if (regime === 'lucro_presumido') {
      // Lucro Presumido: cumulativo (3,65%) ou não-cumulativo (9,25%)
      aliquotaPisCofinsUsada = pisCofinsRegime === 'cumulativo'
        ? ALIQUOTA_PIS_COFINS_CUMULATIVO
        : ALIQUOTA_PIS_COFINS_NAO_CUMULATIVO
      pisCofinsAtual = faturamentoAnual * aliquotaPisCofinsUsada
    } else {
      // Lucro Real: sempre não-cumulativo
      aliquotaPisCofinsUsada = ALIQUOTA_PIS_COFINS_NAO_CUMULATIVO
      pisCofinsAtual = faturamentoAnual * aliquotaPisCofinsUsada
    }
  }

  const icmsAtual = isExportadora
    ? 0
    : faturamentoAnual * (aliquotaIcms / 100) * (cronograma.percentualIcmsIssRestante / 100)

  const issAtual = faturamentoAnual * (aliquotaIss / 100) * (cronograma.percentualIcmsIssRestante / 100)

  const ratioAliquota = pisCofinsRegime === 'cumulativo'
    ? { pis: ALIQUOTA_PIS_CUMULATIVO / ALIQUOTA_PIS_COFINS_CUMULATIVO, cofins: ALIQUOTA_COFINS_CUMULATIVO / ALIQUOTA_PIS_COFINS_CUMULATIVO }
    : { pis: ALIQUOTA_PIS_NAO_CUMULATIVO / ALIQUOTA_PIS_COFINS_NAO_CUMULATIVO, cofins: ALIQUOTA_COFINS_NAO_CUMULATIVO / ALIQUOTA_PIS_COFINS_NAO_CUMULATIVO }

  const tributosAtuais: TributosAtuais = {
    pis: cronograma.pisCofinExtinto ? 0 : pisCofinsAtual * ratioAliquota.pis,
    cofins: cronograma.pisCofinExtinto ? 0 : pisCofinsAtual * ratioAliquota.cofins,
    icms: icmsAtual,
    iss: issAtual,
    total: pisCofinsAtual + icmsAtual + issAtual,
  }

  // ============================================================
  // 2. NOVO SISTEMA (CBS + IBS)
  // ============================================================

  // Alíquotas com redução setorial aplicada
  const cbsEfetiva = calcularAliquotaEfetiva(cronograma.aliquotaCbs, setor) / 100
  const ibsEfetiva = calcularAliquotaEfetiva(cronograma.aliquotaIbs, setor) / 100
  const percentualCbs = (cronograma.percentualCbsVigente ?? 100) / 100
  const percentualIbs = cronograma.percentualIbsVigente / 100

  let cbsBruto = 0
  let ibsBruto = 0

  // A partir de 2027, CBS 8,8% é obrigatória para Lucro Real e Presumido — sem opção de cumulativo
  if (regime !== 'isento' && regime !== 'simples_nacional' && regime !== 'mei' && regime !== 'nanoempreendedor') {
    cbsBruto = isExportadora ? 0 : faturamentoAnual * cbsEfetiva * percentualCbs
    ibsBruto = isExportadora ? 0 : faturamentoAnual * ibsEfetiva * percentualIbs
  } else if (regime === 'simples_nacional' || regime === 'mei' || regime === 'nanoempreendedor') {
    // Simples recolhe CBS+IBS em alíquota diferenciada (~5% total estimado)
    const aliquotaSimples = faturamentoAnual * 0.05
    cbsBruto = aliquotaSimples * 0.35 * percentualCbs // proporção CBS no Simples
    ibsBruto = aliquotaSimples * 0.65 * percentualIbs
  }

  // Imposto Seletivo (se aplicável ao setor)
  const isImpSeletivo = configSetor.sujetoImpSeletivo
    ? faturamentoAnual * ((configSetor.aliquotaIsEstimada ?? 0) / 100)
    : 0

  // ============================================================
  // 3. CRÉDITOS TRIBUTÁRIOS
  // ============================================================

  const creditos = calcularCreditos({
    regime,
    comprasAnuais,
    cronograma,
    setor,
  })

  const cbsLiquido = Math.max(0, cbsBruto - creditos.creditoCbs)
  const ibsLiquido = Math.max(0, ibsBruto - creditos.creditoIbs)

  const tributosNovos: TributosNovos = {
    cbs: cbsLiquido,
    ibs: ibsLiquido,
    isImpSeletivo,
    total: cbsLiquido + ibsLiquido + isImpSeletivo,
  }

  // ============================================================
  // 4. RESULTADO FINAL
  // ============================================================

  const cargaAtual = tributosAtuais.total
  const cargaFutura = tributosNovos.total
  const variacaoAbsoluta = cargaFutura - cargaAtual
  const variacaoPercentual = cargaAtual > 0 ? (variacaoAbsoluta / cargaAtual) * 100 : 0

  // ============================================================
  // 5. COMPARATIVO INFORMATIVO: PIS/COFINS antes de 2027 vs CBS 8,8%
  //    A CBS 8,8% é obrigatória a partir de 2027 — sem opção de regime.
  //    Mostra o impacto conforme o regime que a empresa tinha antes.
  // ============================================================

  let comparativoCbs: ComparativoCbsPresumido | undefined

  if ((regime === 'lucro_presumido' || regime === 'lucro_real') && !isExportadora && !cronograma.isAnoDeTeste) {
    const cbsBrutoComp = faturamentoAnual * cbsEfetiva * percentualCbs
    const creditoCbs = comprasAnuais * cbsEfetiva
    const cbsLiquidoComp = Math.max(0, cbsBrutoComp - creditoCbs)
    const comprasFaturamentoRatio = faturamentoAnual > 0 ? (comprasAnuais / faturamentoAnual) * 100 : 0

    // Referência: se empresa era PIS/COFINS cumulativo (3,65% — Lucro Presumido Lei 9.718/98)
    const pisCofinsAntesCumulativo = faturamentoAnual * ALIQUOTA_PIS_COFINS_CUMULATIVO
    const varCumulativo = cbsLiquidoComp - pisCofinsAntesCumulativo
    const varCumulativoPercent = pisCofinsAntesCumulativo > 0 ? (varCumulativo / pisCofinsAntesCumulativo) * 100 : 0

    // Referência: se empresa era PIS/COFINS não-cumulativo (9,25% com crédito nas entradas)
    const pisCofinsAntesNaoCumulativoBruto = faturamentoAnual * ALIQUOTA_PIS_COFINS_NAO_CUMULATIVO
    // PIS/COFINS não-cumulativo já permitia crédito sobre compras às mesmas alíquotas (PIS 1,65% + COFINS 7,6%)
    const creditoPisCofinsEntradas = comprasAnuais * ALIQUOTA_PIS_COFINS_NAO_CUMULATIVO
    const pisCofinsAntesNaoCumulativoLiquido = Math.max(0, pisCofinsAntesNaoCumulativoBruto - creditoPisCofinsEntradas)
    const varNaoCumulativo = cbsLiquidoComp - pisCofinsAntesNaoCumulativoLiquido
    const varNaoCumulativoPercent = pisCofinsAntesNaoCumulativoLiquido > 0 ? (varNaoCumulativo / pisCofinsAntesNaoCumulativoLiquido) * 100 : 0

    comparativoCbs = {
      cbsLiquido: cbsLiquidoComp,
      creditoAproveitado: creditoCbs,
      cbsBruto: cbsBrutoComp,
      comprasFaturamentoRatio: parseFloat(comprasFaturamentoRatio.toFixed(1)),
      seCumulativo: {
        pisCofinsAntes: pisCofinsAntesCumulativo,
        variacaoAbsoluta: varCumulativo,
        variacaoPercentual: varCumulativoPercent,
        impacto: varCumulativo > 0 ? 'aumento' : varCumulativo < 0 ? 'reducao' : 'neutro',
      },
      seNaoCumulativo: {
        pisCofinsAntes: pisCofinsAntesNaoCumulativoBruto,
        pisCofinsLiquidoAntes: pisCofinsAntesNaoCumulativoLiquido,
        variacaoAbsoluta: varNaoCumulativo,
        variacaoPercentual: varNaoCumulativoPercent,
        impacto: varNaoCumulativo > 0 ? 'aumento' : varNaoCumulativo < 0 ? 'reducao' : 'neutro',
      },
    }
  }

  // Gerar alertas contextuais
  if (configSetor.reducaoPercentual > 0) {
    alertas.push(
      `Seu setor tem redução de ${configSetor.reducaoPercentual}% nas alíquotas — benefício garantido por lei.`
    )
  }
  if (configSetor.creditoVedado) {
    alertas.push(
      'Atenção: o Art. 283 da LC 214/2025 veda ao adquirente dos seus serviços o aproveitamento de crédito de CBS e IBS. Isso afeta a atratividade da sua empresa para clientes de Lucro Real/Presumido — eles não poderão usar sua nota como crédito.'
    )
  }
  if (cronograma.pisCofinExtinto && ano === 2027) {
    alertas.push('A partir de 2027, PIS e COFINS são extintos e substituídos pela CBS (8,8%).')
  }
  if (isExportadora) {
    alertas.push('Operações de exportação são imunes ao CBS e IBS — desonera a cadeia exportadora.')
  }
  if (variacaoPercentual > 10) {
    alertas.push(`Atenção: carga tributária aumenta ${variacaoPercentual.toFixed(1)}% neste ano. Avalie estratégias de crédito.`)
  }
  if (variacaoPercentual < -10) {
    alertas.push(`Benefício: carga tributária reduz ${Math.abs(variacaoPercentual).toFixed(1)}% neste ano.`)
  }

  return {
    ano,
    regime,
    setor,
    tributosAtuais,
    tributosNovos,
    creditos,
    cargaAtual,
    cargaFutura,
    variacaoAbsoluta,
    variacaoPercentual,
    percentualCbsVigente: cronograma.percentualCbsVigente ?? 100,
    percentualIbsVigente: cronograma.percentualIbsVigente,
    percentualIcmsIssRestante: cronograma.percentualIcmsIssRestante,
    alertas,
    comparativoCbs,
  }
}

/**
 * Projeta o impacto tributário para todos os anos da transição (2026–2033).
 */
export function projetarTransicaoCompleta(params: Omit<ParamsCalculo, 'ano'>): ProjecaoTransicao {
  const resultados = ANOS_TRANSICAO.map((ano) =>
    calcularImpacto({ ...params, ano })
  )

  const cargas = resultados.map((r) => r.cargaFutura)
  const menorCarga = Math.min(...cargas)
  const maiorCarga = Math.max(...cargas)
  const anoMenorCarga = resultados[cargas.indexOf(menorCarga)].ano
  const anoMaiorCarga = resultados[cargas.indexOf(maiorCarga)].ano

  return {
    anos: resultados,
    menorCarga,
    maiorCarga,
    anoMenorCarga,
    anoMaiorCarga,
  }
}
