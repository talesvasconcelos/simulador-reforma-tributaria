// Cronograma de transição da Reforma Tributária — LC 214/2025
// Vigência: 2026–2033

export interface CronogramaAno {
  ano: number
  aliquotaCbs: number         // % da CBS vigente
  aliquotaIbs: number         // % do IBS vigente (variável por município/estado)
  percentualIbsVigente: number  // % do IBS que está em efeito (0–100%)
  percentualIcmsIssRestante: number // % do ICMS/ISS ainda vigente (0–100%)
  observacao: string
  pisCofinExtinto: boolean     // PIS/COFINS extintos a partir de 2027
}

export const CRONOGRAMA_TRANSICAO: Record<number, CronogramaAno> = {
  2026: {
    ano: 2026,
    aliquotaCbs: 0.9,
    aliquotaIbs: 0.1,
    percentualIbsVigente: 0,
    percentualIcmsIssRestante: 100,
    observacao: 'Período de teste — CBS e IBS com alíquotas reduzidas, sem recolhimento efetivo obrigatório',
    pisCofinExtinto: false,
  },
  2027: {
    ano: 2027,
    aliquotaCbs: 8.8,
    aliquotaIbs: 0.1,
    percentualIbsVigente: 0,
    percentualIcmsIssRestante: 100,
    observacao: 'CBS plena entra em vigor — PIS/COFINS extintos. IBS ainda em teste.',
    pisCofinExtinto: true,
  },
  2028: {
    ano: 2028,
    aliquotaCbs: 8.8,
    aliquotaIbs: 0.1,
    percentualIbsVigente: 0,
    percentualIcmsIssRestante: 100,
    observacao: 'CBS plena mantida — IBS ainda em período de teste',
    pisCofinExtinto: true,
  },
  2029: {
    ano: 2029,
    aliquotaCbs: 8.8,
    aliquotaIbs: 17.7,
    percentualIbsVigente: 10,
    percentualIcmsIssRestante: 90,
    observacao: 'IBS inicia transição — 10% do IBS pleno entra em vigor',
    pisCofinExtinto: true,
  },
  2030: {
    ano: 2030,
    aliquotaCbs: 8.8,
    aliquotaIbs: 17.7,
    percentualIbsVigente: 20,
    percentualIcmsIssRestante: 80,
    observacao: 'IBS 20% vigente — transição avança',
    pisCofinExtinto: true,
  },
  2031: {
    ano: 2031,
    aliquotaCbs: 8.8,
    aliquotaIbs: 17.7,
    percentualIbsVigente: 30,
    percentualIcmsIssRestante: 70,
    observacao: 'IBS 30% vigente — sistema híbrido em andamento',
    pisCofinExtinto: true,
  },
  2032: {
    ano: 2032,
    aliquotaCbs: 8.8,
    aliquotaIbs: 17.7,
    percentualIbsVigente: 40,
    percentualIcmsIssRestante: 60,
    observacao: 'IBS 40% vigente — ICMS começa a ser extinto gradualmente',
    pisCofinExtinto: true,
  },
  2033: {
    ano: 2033,
    aliquotaCbs: 8.8,
    aliquotaIbs: 17.7,
    percentualIbsVigente: 100,
    percentualIcmsIssRestante: 0,
    observacao: 'Sistema completo — CBS e IBS plenos, ICMS e ISS extintos',
    pisCofinExtinto: true,
  },
}

export const ANOS_TRANSICAO = Object.keys(CRONOGRAMA_TRANSICAO).map(Number).sort()
