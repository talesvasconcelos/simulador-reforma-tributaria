// Análise estratégica de faturamento — impacto da Reforma no CBS/IBS cobrado por tipo de cliente

import { CRONOGRAMA_TRANSICAO } from './cronograma'
import { ALIQUOTAS_SETORIAIS, calcularAliquotaEfetiva } from './aliquotas'

export interface PerfilClientes {
  percentualB2BPrivado: number   // % do faturamento para empresas privadas
  percentualPublico: number      // % do faturamento para entes públicos (governo)
  percentualB2C: number          // % para consumidores finais (calculado automaticamente)
}

export interface ParamsAnaliseFaturamento {
  faturamentoMensal: number
  setor: string
  regime: string
  perfilClientes: PerfilClientes
  creditosMensaisFornecedores: number  // créditos totais vindos da análise de fornecedores
  ano: number
  aliquotaIcms?: number  // % ICMS atual da empresa (ex: 18.0) — vem do cadastro
  aliquotaIss?: number   // % ISS atual da empresa (ex: 3.0)  — vem do cadastro
}

export interface AnaliseTipoCliente {
  faturamentoMensal: number
  cbsIbsCobrado: number           // CBS+IBS destacado nas notas emitidas
  splitPaymentRetido: number       // retido automaticamente no pagamento
  creditoTransferidoAoComprador: number  // crédito que o comprador pode apropriar
  percentualCredito: number
  observacao: string
}

export interface EstrategiaRecomendada {
  titulo: string
  descricao: string
  impactoEstimado: string
  prioridade: 'alta' | 'media' | 'baixa'
  tipo: 'regime' | 'credito' | 'precificacao' | 'fluxo_caixa' | 'setor'
}

export interface ResultadoAnaliseFaturamento {
  // CBS/IBS bruto nas vendas
  cbsBrutoMensal: number
  ibsBrutoMensal: number
  totalImpostoNasVendas: number

  // Créditos das compras (de fornecedores)
  creditosFornecedores: number

  // Tributos antigos ainda vigentes no ano selecionado (ICMS/ISS × % restante)
  icmsIssRestanteMensal: number

  // PIS/COFINS: vigente em 2026, extinto a partir de 2027
  pisCofinsRestanteMensal: number

  // Saldo CBS/IBS líquido (apenas os novos tributos)
  saldoCbsIbsLiquidoMensal: number

  // Saldo total real a pagar no ano = CBS/IBS líquido + ICMS/ISS restante + PIS/COFINS (se vigente)
  saldoLiquidoMensal: number

  // Split payment (somente CBS/IBS — ICMS/ISS não usam split payment)
  retidoSplitPaymentMensal: number
  receitaLiquidaMensal: number       // o que realmente entra no caixa

  // Por tipo de cliente
  porTipoCliente: {
    b2bPrivado: AnaliseTipoCliente
    publico: AnaliseTipoCliente
    b2c: AnaliseTipoCliente
  }

  // Comparação sistema atual vs reforma
  comparacao: {
    sistemaAtual: { pisCofins: number; icms: number; iss: number; total: number }
    reforma: { cbs: number; ibs: number; icmsIssRestante: number; totalBruto: number; liquido: number }
    variacao: number
    variacaoPercentual: number
  }

  // Atratividade para clientes B2B
  percentualCreditoGeradoB2B: number

  // Estratégias de mitigação recomendadas
  estrategias: EstrategiaRecomendada[]
}

// Setores que tipicamente pagam ICMS (não ISS) — varejo, atacado, indústria, agro
const SETORES_ICMS = new Set(['industria', 'comercio_atacado', 'comercio_varejo', 'agronegocio'])

/**
 * Estimativa de ISS quando não há alíquota cadastrada.
 * Retorna 0 para setores ICMS-payers, 3% para os demais (ISS médio nacional).
 */
function estimarIss(setor: string, regime: string): number {
  if (SETORES_ICMS.has(setor)) return 0
  if (regime === 'mei') return 0.5
  if (regime === 'simples_nacional') return 2
  return 3  // LR/LP — ISS médio municipal
}

/**
 * Analisa o impacto da Reforma Tributária no faturamento da empresa,
 * segmentando por tipo de cliente e gerando estratégias de mitigação.
 */
export function analisarFaturamento(params: ParamsAnaliseFaturamento): ResultadoAnaliseFaturamento {
  const { faturamentoMensal, setor, regime, perfilClientes, creditosMensaisFornecedores, ano } = params
  const cronograma = CRONOGRAMA_TRANSICAO[ano] ?? CRONOGRAMA_TRANSICAO[2027]
  const configSetor = ALIQUOTAS_SETORIAIS[setor] ?? ALIQUOTAS_SETORIAIS.misto

  // Alíquotas dos tributos antigos (do cadastro da empresa, com fallback para estimativas setoriais)
  const aliquotaIcmsPct = (params.aliquotaIcms ?? 0) / 100
  const aliquotaIssPct  = (params.aliquotaIss  ?? estimarIss(setor, regime)) / 100
  const percentualIcmsIssRestante = cronograma.percentualIcmsIssRestante / 100

  // Tributos antigos ainda vigentes neste ano da transição
  const icmsRestanteMensal = faturamentoMensal * aliquotaIcmsPct * percentualIcmsIssRestante
  const issRestanteMensal  = faturamentoMensal * aliquotaIssPct  * percentualIcmsIssRestante
  const icmsIssRestanteMensal = icmsRestanteMensal + issRestanteMensal

  // PIS/COFINS: vigente em 2026 (não extinto ainda), extinto a partir de 2027 quando CBS entra plena
  const pisCofinsRestanteMensal = cronograma.pisCofinExtinto ? 0 : (() => {
    if (regime === 'lucro_real' || regime === 'lucro_presumido') return faturamentoMensal * 0.0925
    if (regime === 'simples_nacional') return faturamentoMensal * 0.03
    if (regime === 'mei') return 0
    return 0
  })()

  // ── 1. CBS/IBS cobrado nas vendas ─────────────────────────────────────────

  const cbsEfetivaPct = calcularAliquotaEfetiva(cronograma.aliquotaCbs, setor) / 100
  const ibsEfetivaPct = calcularAliquotaEfetiva(cronograma.aliquotaIbs, setor) / 100
  const percentualCbsVigente = (cronograma.percentualCbsVigente ?? 100) / 100
  const percentualIbsVigente = cronograma.percentualIbsVigente / 100

  let cbsBrutoMensal = 0
  let ibsBrutoMensal = 0
  let percentualCreditoGeradoB2B = 0

  // 2026: período de teste — CBS/IBS apenas informativo, sem pagamento e sem crédito (Art. 359 LC 214/2025)
  const isAnoDeTeste = cronograma.isAnoDeTeste ?? false

  if (!isAnoDeTeste) {
    if (regime === 'lucro_real' || regime === 'lucro_presumido') {
      cbsBrutoMensal = faturamentoMensal * cbsEfetivaPct * percentualCbsVigente
      ibsBrutoMensal = faturamentoMensal * ibsEfetivaPct * percentualIbsVigente
      percentualCreditoGeradoB2B = (cbsEfetivaPct + ibsEfetivaPct * percentualIbsVigente) * 100
    } else if (regime === 'simples_nacional') {
      cbsBrutoMensal = faturamentoMensal * cbsEfetivaPct * percentualCbsVigente * 0.30
      ibsBrutoMensal = faturamentoMensal * ibsEfetivaPct * percentualIbsVigente * 0.15
      percentualCreditoGeradoB2B = 1.5
    } else if (regime === 'mei') {
      cbsBrutoMensal = 0
      ibsBrutoMensal = 0
      percentualCreditoGeradoB2B = 0
    }
  }
  // 2026 (isAnoDeTeste) e nanoempreendedor: zero em tudo

  const totalImpostoNasVendas = cbsBrutoMensal + ibsBrutoMensal
  const cbsIbsPorRealFaturado = faturamentoMensal > 0 ? totalImpostoNasVendas / faturamentoMensal : 0

  // Saldo CBS/IBS líquido (novos tributos - créditos das compras)
  const saldoCbsIbsLiquidoMensal = Math.max(0, totalImpostoNasVendas - creditosMensaisFornecedores)

  // Saldo total real = CBS/IBS líquido + ICMS/ISS ainda vigente + PIS/COFINS (se ainda não extinto)
  const saldoLiquidoMensal = saldoCbsIbsLiquidoMensal + icmsIssRestanteMensal + pisCofinsRestanteMensal

  // Split payment: o banco retém SOMENTE o CBS/IBS (ICMS/ISS não usam split payment)
  const retidoSplitPaymentMensal = totalImpostoNasVendas
  const receitaLiquidaMensal = faturamentoMensal - retidoSplitPaymentMensal

  // ── 2. Análise por tipo de cliente ────────────────────────────────────────

  const faturB2B = faturamentoMensal * (perfilClientes.percentualB2BPrivado / 100)
  const faturPublico = faturamentoMensal * (perfilClientes.percentualPublico / 100)
  const faturB2C = faturamentoMensal * (perfilClientes.percentualB2C / 100)

  const porTipoCliente = {
    b2bPrivado: {
      faturamentoMensal: faturB2B,
      cbsIbsCobrado: faturB2B * cbsIbsPorRealFaturado,
      splitPaymentRetido: faturB2B * cbsIbsPorRealFaturado,
      creditoTransferidoAoComprador: faturB2B * (percentualCreditoGeradoB2B / 100),
      percentualCredito: percentualCreditoGeradoB2B,
      observacao: regime === 'simples_nacional'
        ? 'Cliente B2B recupera apenas ~1,5% em crédito presumido. Isso reduz sua competitividade frente a concorrentes no Lucro Real/Presumido que geram crédito integral.'
        : regime === 'mei'
        ? 'MEI não destaca CBS/IBS — cliente B2B não gera crédito nenhum nessas compras.'
        : `Cliente B2B recupera ${percentualCreditoGeradoB2B.toFixed(1)}% do valor pago como crédito — você é competitivo para compradores de Lucro Real/Presumido.`,
    },
    publico: {
      faturamentoMensal: faturPublico,
      cbsIbsCobrado: faturPublico * cbsIbsPorRealFaturado,
      splitPaymentRetido: faturPublico * cbsIbsPorRealFaturado,
      creditoTransferidoAoComprador: 0,  // entes públicos não apropriam créditos de CBS/IBS
      percentualCredito: 0,
      observacao: 'Entes públicos não apropriam créditos de CBS/IBS. O split payment é automático e obrigatório nos pagamentos públicos. Contratos firmados antes de 2026 precisam de cláusula de reajuste para absorver o impacto da reforma.',
    },
    b2c: {
      faturamentoMensal: faturB2C,
      cbsIbsCobrado: faturB2C * cbsIbsPorRealFaturado,
      splitPaymentRetido: faturB2C * cbsIbsPorRealFaturado,
      creditoTransferidoAoComprador: 0,  // consumidor final não usa créditos
      percentualCredito: 0,
      observacao: 'Consumidor final arca com o tributo embutido no preço. Consumidores de baixa renda terão cashback parcial previsto na LC 214/2025. O split payment reduz imediatamente o caixa recebido.',
    },
  }

  // ── 3. Comparação sistema atual vs reforma ────────────────────────────────

  // Sistema atual (100% dos tributos antigos — baseline pré-reforma)
  let pisCofinsBaseline = 0
  let icmsBaseline = faturamentoMensal * aliquotaIcmsPct
  let issBaseline = faturamentoMensal * aliquotaIssPct
  if (regime === 'lucro_real' || regime === 'lucro_presumido') {
    pisCofinsBaseline = faturamentoMensal * 0.0925  // 9,25% (PIS 1,65% + COFINS 7,6%)
  } else if (regime === 'simples_nacional') {
    pisCofinsBaseline = faturamentoMensal * 0.03    // proporção PIS/COFINS dentro do DAS
    // ICMS/ISS do Simples estimados se não cadastrados
    if (!params.aliquotaIcms) icmsBaseline = 0
    if (!params.aliquotaIss)  issBaseline = faturamentoMensal * 0.02
  } else if (regime === 'mei') {
    pisCofinsBaseline = 0
    if (!params.aliquotaIcms) icmsBaseline = 0
    if (!params.aliquotaIss)  issBaseline = faturamentoMensal * 0.005
  }

  const totalAtual = pisCofinsBaseline + icmsBaseline + issBaseline
  const variacao = saldoLiquidoMensal - totalAtual
  const variacaoPercentual = totalAtual > 0 ? (variacao / totalAtual) * 100 : 0

  const comparacao = {
    sistemaAtual: { pisCofins: pisCofinsBaseline, icms: icmsBaseline, iss: issBaseline, total: totalAtual },
    reforma: {
      cbs: cbsBrutoMensal,
      ibs: ibsBrutoMensal,
      icmsIssRestante: icmsIssRestanteMensal,
      totalBruto: totalImpostoNasVendas,
      liquido: saldoLiquidoMensal,
    },
    variacao,
    variacaoPercentual,
  }

  // ── 4. Estratégias de mitigação ───────────────────────────────────────────

  const estrategias: EstrategiaRecomendada[] = []

  // Migração de regime: Simples com clientes B2B
  if (regime === 'simples_nacional' && perfilClientes.percentualB2BPrivado > 30) {
    const creditoAtual = faturB2B * 0.015
    const creditoComLucroPresumido = faturB2B * (cbsEfetivaPct + ibsEfetivaPct * percentualIbsVigente)
    const ganhoCredito = creditoComLucroPresumido - creditoAtual
    estrategias.push({
      titulo: 'Avaliar migração para Lucro Presumido',
      descricao: `${perfilClientes.percentualB2BPrivado}% do seu faturamento é B2B. No Simples, seus clientes recuperam apenas ~1,5% em crédito presumido. Se migrar para Lucro Presumido, passariam a recuperar ${(percentualCreditoGeradoB2B).toFixed(1)}% — permitindo renegociar preços para cima e ainda assim ser mais vantajoso para eles.`,
      impactoEstimado: `Crédito gerado para clientes: R$ ${Math.round(creditoAtual).toLocaleString('pt-BR')}/mês → R$ ${Math.round(creditoComLucroPresumido).toLocaleString('pt-BR')}/mês (+R$ ${Math.round(ganhoCredito).toLocaleString('pt-BR')})`,
      prioridade: 'alta',
      tipo: 'regime',
    })
  }

  // Contratos públicos de longo prazo
  if (perfilClientes.percentualPublico > 15) {
    estrategias.push({
      titulo: 'Revisar contratos com entes públicos',
      descricao: 'Contratos firmados antes de 2027 podem não ter cláusula de reajuste tributário para a reforma. O split payment automático nos pagamentos públicos pode gerar defasagem de fluxo de caixa. Recomenda-se incluir cláusula de equilíbrio econômico-financeiro nos contratos em vigor.',
      impactoEstimado: `R$ ${Math.round(faturPublico * cbsIbsPorRealFaturado).toLocaleString('pt-BR')}/mês retidos via split payment em contratos públicos`,
      prioridade: 'alta',
      tipo: 'precificacao',
    })
  }

  // Split payment — reserva de capital de giro
  if (retidoSplitPaymentMensal > 0) {
    estrategias.push({
      titulo: 'Constituir reserva para split payment',
      descricao: 'O split payment retém o CBS/IBS automaticamente no momento do pagamento. Os créditos são ressarcidos em até 15 dias úteis + 10 dias bancários. Durante esse período, a empresa precisa ter capital de giro para cobrir o intervalo entre retenção e ressarcimento.',
      impactoEstimado: `R$ ${Math.round(retidoSplitPaymentMensal).toLocaleString('pt-BR')}/mês retidos antecipadamente — reserva mínima recomendada: R$ ${Math.round(retidoSplitPaymentMensal * 1.5).toLocaleString('pt-BR')} (45 dias)`,
      prioridade: 'media',
      tipo: 'fluxo_caixa',
    })
  }

  // Créditos de fornecedores insuficientes
  if (totalImpostoNasVendas > 0 && creditosMensaisFornecedores < totalImpostoNasVendas * 0.25) {
    estrategias.push({
      titulo: 'Ampliar base de créditos de CBS/IBS nas compras',
      descricao: 'Seus créditos de compras cobrem menos de 25% do CBS/IBS das suas vendas. Aumentar compras de fornecedores no Lucro Real/Presumido reduz diretamente o saldo a recolher. Veja a aba Fornecedores para identificar oportunidades.',
      impactoEstimado: `Créditos atuais: R$ ${Math.round(creditosMensaisFornecedores).toLocaleString('pt-BR')}/mês | CBS/IBS vendas: R$ ${Math.round(totalImpostoNasVendas).toLocaleString('pt-BR')}/mês | Potencial de melhora: até R$ ${Math.round(totalImpostoNasVendas * 0.5).toLocaleString('pt-BR')}/mês`,
      prioridade: 'alta',
      tipo: 'credito',
    })
  }

  // Redução setorial vigente
  if (configSetor.reducaoPercentual > 0 && configSetor.reducaoPercentual < 100) {
    estrategias.push({
      titulo: `Redução setorial de ${configSetor.reducaoPercentual}% — garantir CNAE correto`,
      descricao: `Seu setor tem redução de ${configSetor.reducaoPercentual}% nas alíquotas. Esse benefício depende do CNAE correto na nota fiscal. Certifique-se de que o CNAE cadastrado na Receita Federal corresponde à sua atividade principal e revise com seu contador antes de 2027.`,
      impactoEstimado: `Economia de ${configSetor.reducaoPercentual}% sobre o CBS+IBS que seria cobrado no regime padrão`,
      prioridade: 'baixa',
      tipo: 'setor',
    })
  }

  // Setor padrão com atividades mistas
  if (configSetor.reducaoPercentual === 0 && ['servicos', 'tecnologia'].includes(setor)) {
    estrategias.push({
      titulo: 'Verificar enquadramento como profissional liberal',
      descricao: 'Empresas de serviços e TI que atuam como profissionais liberais (CNAE 69/70/71/74/75) têm 30% de redução. Se sua atividade principal se encaixa nessa definição, revisar o CNAE pode gerar redução imediata na carga tributária.',
      impactoEstimado: 'Potencial redução de 30% sobre CBS+IBS das suas vendas',
      prioridade: 'media',
      tipo: 'setor',
    })
  }

  // Repricing para contratos B2B de longa duração
  if (perfilClientes.percentualB2BPrivado > 50 && variacao > 0) {
    estrategias.push({
      titulo: 'Revisar precificação de contratos B2B recorrentes',
      descricao: 'Contratos recorrentes com clientes B2B assinados sob o sistema atual podem estar subprecificados para a reforma. Ao mesmo tempo, se você estiver no Lucro Real/Presumido, o aumento de crédito gerado para o cliente pode justificar um aumento de preço sem impacto no custo efetivo dele.',
      impactoEstimado: `Variação estimada na carga: ${variacao > 0 ? '+' : ''}R$ ${Math.round(Math.abs(variacao)).toLocaleString('pt-BR')}/mês`,
      prioridade: 'media',
      tipo: 'precificacao',
    })
  }

  return {
    cbsBrutoMensal,
    ibsBrutoMensal,
    totalImpostoNasVendas,
    creditosFornecedores: creditosMensaisFornecedores,
    icmsIssRestanteMensal,
    pisCofinsRestanteMensal,
    saldoCbsIbsLiquidoMensal,
    saldoLiquidoMensal,
    retidoSplitPaymentMensal,
    receitaLiquidaMensal,
    porTipoCliente,
    comparacao,
    percentualCreditoGeradoB2B,
    estrategias,
  }
}
