// Alíquotas setoriais da Reforma Tributária — LC 214/2025
// Alíquota padrão CBS: 8.8% | IBS: 17.7% (total referência: ~26.5%)

export interface AliquotaSetor {
  setor: string
  reducaoPercentual: number      // % de redução nas alíquotas (0, 30, 60)
  sujetoImpSeletivo: boolean     // Sujeito ao Imposto Seletivo
  aliquotaIsEstimada?: number    // Alíquota estimada do IS (%)
  regime: 'padrao' | 'especial' | 'monofasico'
  observacao: string
}

export const ALIQUOTAS_SETORIAIS: Record<string, AliquotaSetor> = {
  industria: {
    setor: 'industria',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Regime padrão — sem redução de alíquota',
  },
  comercio_atacado: {
    setor: 'comercio_atacado',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Regime padrão — sem redução de alíquota',
  },
  comercio_varejo: {
    setor: 'comercio_varejo',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Regime padrão — sem redução de alíquota',
  },
  servicos: {
    setor: 'servicos',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Serviços gerais — regime padrão',
  },
  servicos_saude: {
    setor: 'servicos_saude',
    reducaoPercentual: 60,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'Serviços de saúde — 60% de redução garantida por lei (art. 130 LC 214/2025)',
  },
  servicos_educacao: {
    setor: 'servicos_educacao',
    reducaoPercentual: 60,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'Serviços de educação — 60% de redução garantida por lei (art. 130 LC 214/2025)',
  },
  servicos_financeiros: {
    setor: 'servicos_financeiros',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'Regime especial para serviços financeiros — alíquotas serão definidas pelo CGIBS',
  },
  agronegocio: {
    setor: 'agronegocio',
    reducaoPercentual: 60,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'Produtos agropecuários in natura — 60% de redução. Produtos industrializados: regime padrão',
  },
  construcao_civil: {
    setor: 'construcao_civil',
    reducaoPercentual: 30,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'Construção civil — 30% de redução prevista',
  },
  transporte: {
    setor: 'transporte',
    reducaoPercentual: 30,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'Transporte coletivo de passageiros — 30% de redução. Cargas: regime padrão',
  },
  tecnologia: {
    setor: 'tecnologia',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Tecnologia — regime padrão sem redução específica',
  },
  misto: {
    setor: 'misto',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Atividade mista — aplica-se alíquota padrão (análise individualizada recomendada)',
  },
}

/**
 * Calcula a alíquota efetiva após redução setorial
 */
export function calcularAliquotaEfetiva(
  aliquotaBase: number,
  setor: string
): number {
  const config = ALIQUOTAS_SETORIAIS[setor] ?? ALIQUOTAS_SETORIAIS.misto
  const fatorReducao = 1 - config.reducaoPercentual / 100
  return aliquotaBase * fatorReducao
}
