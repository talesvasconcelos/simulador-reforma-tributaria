// Cronograma de transição da Reforma Tributária — LC 214/2025
// Vigência: 2026–2033

export interface CronogramaAno {
  ano: number
  aliquotaCbs: number         // % da CBS vigente
  aliquotaIbs: number         // % do IBS vigente (variável por município/estado)
  percentualIbsVigente: number  // % do IBS que está em efeito (0–100%)
  percentualCbsVigente: number  // % da CBS que está em efeito (0–100%) — 0 em 2026 (crédito de implantação zera o débito do vendedor)
  percentualIcmsIssRestante: number // % do ICMS/ISS ainda vigente (0–100%)
  observacao: string
  pisCofinExtinto: boolean     // PIS/COFINS extintos a partir de 2027
  isAnoDeTeste: boolean        // 2026: CBS/IBS destacados mas com crédito de implantação integral — saldo líquido zero para o vendedor
}

export const CRONOGRAMA_TRANSICAO: Record<number, CronogramaAno> = {
  2026: {
    ano: 2026,
    aliquotaCbs: 0.9,
    aliquotaIbs: 0.1,
    percentualCbsVigente: 0,   // crédito de implantação zera o débito do vendedor — Art. 359 LC 214/2025
    percentualIbsVigente: 0,
    percentualIcmsIssRestante: 100,
    observacao: 'Período de teste — CBS 0,9% e IBS 0,1% destacados na NF, mas vendedor recebe crédito de implantação integral. Saldo líquido zero. PIS/COFINS + ICMS/ISS 100% vigentes.',
    pisCofinExtinto: false,
    isAnoDeTeste: true,
  },
  2027: {
    ano: 2027,
    aliquotaCbs: 8.8,
    aliquotaIbs: 0.1,
    percentualCbsVigente: 100,
    percentualIbsVigente: 0,
    percentualIcmsIssRestante: 100,
    observacao: 'CBS plena entra em vigor — PIS/COFINS extintos. IBS ainda em teste (saldo zero para vendedor). ICMS/ISS 100% vigentes.',
    pisCofinExtinto: true,
    isAnoDeTeste: false,
  },
  2028: {
    ano: 2028,
    aliquotaCbs: 8.8,
    aliquotaIbs: 0.1,
    percentualCbsVigente: 100,
    percentualIbsVigente: 0,
    percentualIcmsIssRestante: 100,
    observacao: 'CBS plena mantida — IBS ainda em período de teste. ICMS/ISS 100% vigentes.',
    pisCofinExtinto: true,
    isAnoDeTeste: false,
  },
  2029: {
    ano: 2029,
    aliquotaCbs: 8.8,
    aliquotaIbs: 17.7,
    percentualCbsVigente: 100,
    percentualIbsVigente: 10,
    percentualIcmsIssRestante: 90,
    observacao: 'IBS inicia transição — 10% do IBS pleno entra em vigor. ICMS/ISS reduzem para 90%.',
    pisCofinExtinto: true,
    isAnoDeTeste: false,
  },
  2030: {
    ano: 2030,
    aliquotaCbs: 8.8,
    aliquotaIbs: 17.7,
    percentualCbsVigente: 100,
    percentualIbsVigente: 20,
    percentualIcmsIssRestante: 80,
    observacao: 'IBS 20% vigente — transição avança. ICMS/ISS reduzem para 80%.',
    pisCofinExtinto: true,
    isAnoDeTeste: false,
  },
  2031: {
    ano: 2031,
    aliquotaCbs: 8.8,
    aliquotaIbs: 17.7,
    percentualCbsVigente: 100,
    percentualIbsVigente: 30,
    percentualIcmsIssRestante: 70,
    observacao: 'IBS 30% vigente — sistema híbrido em andamento. ICMS/ISS reduzem para 70%.',
    pisCofinExtinto: true,
    isAnoDeTeste: false,
  },
  2032: {
    ano: 2032,
    aliquotaCbs: 8.8,
    aliquotaIbs: 17.7,
    percentualCbsVigente: 100,
    percentualIbsVigente: 40,
    percentualIcmsIssRestante: 60,
    observacao: 'IBS 40% vigente — ICMS começa a ser extinto gradualmente. ICMS/ISS reduzem para 60%.',
    pisCofinExtinto: true,
    isAnoDeTeste: false,
  },
  2033: {
    ano: 2033,
    aliquotaCbs: 8.8,
    aliquotaIbs: 17.7,
    percentualCbsVigente: 100,
    percentualIbsVigente: 100,
    percentualIcmsIssRestante: 0,
    observacao: 'Sistema completo — CBS e IBS plenos, ICMS e ISS extintos.',
    pisCofinExtinto: true,
    isAnoDeTeste: false,
  },
}

export const ANOS_TRANSICAO = Object.keys(CRONOGRAMA_TRANSICAO).map(Number).sort()
