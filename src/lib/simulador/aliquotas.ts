// Alíquotas setoriais da Reforma Tributária — LC 214/2025
// Alíquota padrão CBS: 8.8% | IBS: 17.7% (total referência: ~26.5%)

export interface AliquotaSetor {
  setor: string
  reducaoPercentual: number      // % de redução nas alíquotas (0, 30, 40, 60, 100=zero)
  sujetoImpSeletivo: boolean     // Sujeito ao Imposto Seletivo
  aliquotaIsEstimada?: number    // Alíquota estimada do IS (%)
  regime: 'padrao' | 'especial' | 'monofasico'
  observacao: string
  uiOnly?: boolean               // Apenas informativo — não é setor de empresa cadastrável
  creditoVedado?: boolean        // Art. 283 LC 214/2025 — comprador NÃO pode apropriar crédito
}

export const ALIQUOTAS_SETORIAIS: Record<string, AliquotaSetor> = {

  // ─── INDÚSTRIA ───────────────────────────────────────────────────────────────
  industria: {
    setor: 'industria',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Regime padrão — sem redução de alíquota. Indústrias sujeitas ao Imposto Seletivo (tabaco, bebidas alcoólicas, veículos) têm tributação adicional sobre o IS',
  },

  // ─── COMÉRCIO ─────────────────────────────────────────────────────────────────
  comercio_atacado: {
    setor: 'comercio_atacado',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Regime padrão — sem redução. Atacadistas de alimentos da cesta básica podem ter alíquota zero sobre esses produtos específicos',
  },
  comercio_varejo: {
    setor: 'comercio_varejo',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Regime padrão — sem redução. Produtos da cesta básica nacional têm alíquota zero; outros produtos mantêm alíquota padrão',
  },

  // ─── SERVIÇOS GERAIS ──────────────────────────────────────────────────────────
  servicos: {
    setor: 'servicos',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Serviços gerais — regime padrão sem redução específica. Inclui alimentação (CNAE 56), entretenimento, manutenção, publicidade, limpeza, vigilância, etc.',
  },

  // ─── HOTELARIA — REGIME ESPECÍFICO (Arts. 277–283 LC 214/2025) ───────────────
  hotelaria: {
    setor: 'hotelaria',
    reducaoPercentual: 40,
    sujetoImpSeletivo: false,
    regime: 'especial',
    creditoVedado: true,
    observacao: 'CNAE 55 — Hotéis, pousadas, apart-hotéis, albergues e demais serviços de alojamento temporário. Regime específico do Capítulo VII, Título V da LC 214/2025. Art. 281: redução de 40% nas alíquotas de CBS e IBS. Art. 283: vedada a apropriação de créditos pelo adquirente do serviço de hospedagem.',
  },
  parques_diversao: {
    setor: 'parques_diversao',
    reducaoPercentual: 40,
    sujetoImpSeletivo: false,
    regime: 'especial',
    creditoVedado: true,
    observacao: 'CNAE 9321 — Parques de diversão e parques temáticos. Mesmo regime específico da hotelaria (Capítulo VII, Título V da LC 214/2025). Art. 281: redução de 40% nas alíquotas de CBS e IBS. Art. 283: vedada a apropriação de créditos pelo adquirente.',
    uiOnly: true,
  },

  profissionais_liberais: {
    setor: 'profissionais_liberais',
    reducaoPercentual: 30,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 69/70/71/74/75 — Advogados, contadores, arquitetos, engenheiros, consultores, veterinários. Redução de 30% nas alíquotas de CBS e IBS (LC 214/2025). Inclui empresas de TI que prestam serviços como profissionais liberais',
  },

  // ─── SAÚDE ────────────────────────────────────────────────────────────────────
  servicos_saude: {
    setor: 'servicos_saude',
    reducaoPercentual: 60,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 86/87/88 — Hospitais, clínicas, laboratórios, serviços de fisioterapia, odontologia. 60% de redução garantida por lei (LC 214/2025). Equipamentos médicos e hospitalares também têm redução',
  },
  planos_saude: {
    setor: 'planos_saude',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'Planos e seguros de saúde — regime específico. As alíquotas definitivas serão fixadas por regulamentação posterior (LC 214/2025). Tratamento diferente dos serviços médicos diretos',
    uiOnly: true,
  },
  medicamentos_oncologicos: {
    setor: 'medicamentos_oncologicos',
    reducaoPercentual: 100,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'Medicamentos oncológicos e linhas específicas — ALÍQUOTA ZERO de CBS e IBS (LC 227/2026). Lista definida em regulamentação. Medicamentos gerais têm alíquota reduzida (percentual a ser regulamentado)',
    uiOnly: true,
  },

  // ─── EDUCAÇÃO ─────────────────────────────────────────────────────────────────
  servicos_educacao: {
    setor: 'servicos_educacao',
    reducaoPercentual: 60,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 85 — Ensino básico (infantil, fundamental, médio), superior, técnico e profissionalizante. 60% de redução garantida por lei (LC 214/2025)',
  },
  cursos_livres: {
    setor: 'cursos_livres',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Cursos livres, idiomas, preparatórios, cursos online — análise caso a caso segundo LC 214/2025. Sem garantia de redução de 60%. Podem ou não ser enquadrados junto ao ensino formal dependendo de regulamentação',
    uiOnly: true,
  },

  // ─── SERVIÇOS FINANCEIROS ────────────────────────────────────────────────────
  servicos_financeiros: {
    setor: 'servicos_financeiros',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 64/65/66 — Bancos, financeiras, seguradoras, corretoras. Regime específico com alíquota diferenciada progressiva: CBS+IBS de 10,85% em 2027 → 12,5% em 2033 (não segue o cronograma padrão). Programas de fidelidade/milhas: mesmo regime financeiro. Importação de serviços financeiros (captação exterior): alíquota zero em operações específicas.',
  },
  fii_fiagro: {
    setor: 'fii_fiagro',
    reducaoPercentual: 100,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'Fundos de Investimento Imobiliário (FII) e Fundos de Investimento do Agronegócio (Fiagro) — ISENÇÃO de CBS e IBS garantida pela LC 214/2025 após derrubada do veto presidencial. CNAE 64.20-1-00. Atenção: aplica-se ao fundo em si; empresas que investem em FIIs/Fiagros seguem o regime tributário próprio.',
    uiOnly: true,
  },

  // ─── AGRONEGÓCIO ─────────────────────────────────────────────────────────────
  agronegocio: {
    setor: 'agronegocio',
    reducaoPercentual: 60,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 01/02/03 — Produtos agropecuários, pesqueiros e florestais IN NATURA: 60% de redução. Atenção: produtos industrializados do agro (CNAE 10–33) seguem o regime da indústria, sem redução. FIIs e Fiagros: isenção de CBS e IBS',
  },
  insumos_agricolas: {
    setor: 'insumos_agricolas',
    reducaoPercentual: 30,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'Insumos agrícolas (sementes, fertilizantes, defensivos, máquinas agrícolas) — redução prevista na LC 214/2025, percentual exato depende do produto. Cooperativas têm crédito presumido específico',
    uiOnly: true,
  },

  // ─── CONSTRUÇÃO CIVIL ─────────────────────────────────────────────────────────
  construcao_civil: {
    setor: 'construcao_civil',
    reducaoPercentual: 30,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'Construção civil (genérico) — 30% de redução. Consulte os sub-tipos abaixo para o tratamento específico do seu CNAE',
  },
  construcao_edificios: {
    setor: 'construcao_edificios',
    reducaoPercentual: 30,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 41 — Incorporação e construção de edifícios residenciais e comerciais. 30% de redução. Imóveis residenciais novos têm "redutor social" adicional sobre a base de cálculo (arts. 259–260 LC 214/2025), diminuindo ainda mais o custo efetivo para o comprador final',
  },
  construcao_infraestrutura: {
    setor: 'construcao_infraestrutura',
    reducaoPercentual: 30,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 42 — Obras de infraestrutura: rodovias, ferrovias, pontes, viadutos, redes de água/esgoto, aeroportos, oleodutos, barragens. 30% de redução. Obras contratadas por entes públicos podem ter tratamento específico conforme regulamentação do CGIBS (aguardar)',
  },
  construcao_servicos_especializados: {
    setor: 'construcao_servicos_especializados',
    reducaoPercentual: 30,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 43 — Serviços especializados para construção: demolição, preparação de terrenos, instalações elétricas, hidráulicas, ar-condicionado, fachadas, impermeabilização, pintura e acabamentos. 30% de redução. O regime segue o prestador, independente de para qual obra o serviço é prestado',
  },

  // ─── TRANSPORTE ───────────────────────────────────────────────────────────────
  transporte: {
    setor: 'transporte',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Transporte (genérico) — regime padrão. Consulte os sub-tipos: transporte coletivo de passageiros tem 60% de redução; transporte de cargas segue regime geral sem redução',
  },
  transporte_coletivo_passageiros: {
    setor: 'transporte_coletivo_passageiros',
    reducaoPercentual: 60,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 4921/4922/4929 — Transporte rodoviário coletivo de passageiros urbano e intermunicipal. 60% de redução garantida por lei (LC 214/2025). Aplica-se a ônibus urbanos, metrô, trens de passageiros. Táxi e aplicativos de transporte (4923): aguardar regulamentação',
  },
  transporte_cargas: {
    setor: 'transporte_cargas',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'CNAE 4930/50/51/52/53 — Transporte de cargas (rodoviário, ferroviário), transporte aéreo de passageiros e cargas, transporte aquaviário, logística e armazenagem. Regime geral sem redução de alíquota',
  },

  // ─── IMÓVEIS ──────────────────────────────────────────────────────────────────
  imoveis: {
    setor: 'imoveis',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 68 — Atividades imobiliárias (compra, venda, aluguel de imóveis). Não há redução de alíquota, mas imóveis residenciais novos e locação têm "redutor social" na BASE DE CÁLCULO (arts. 259–260 LC 214/2025), que diminui o valor sobre o qual o tributo incide. Imóveis comerciais: regime geral com créditos plenos',
  },

  // ─── COMBUSTÍVEIS E ENERGIA ──────────────────────────────────────────────────
  combustiveis_energia: {
    setor: 'combustiveis_energia',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'monofasico',
    observacao: 'CNAE 19/35 — Combustíveis (derivados de petróleo, biocombustíveis) e energia elétrica e gás natural. REGIME MONOFÁSICO: o tributo é recolhido uma única vez no início da cadeia (refinaria ou distribuidora). Os elos seguintes (postos, varejistas) NÃO recolhem CBS/IBS sobre a mesma base, mas também NÃO geram crédito adicional para o comprador. Energia elétrica tem tratamento reduzido específico',
  },

  // ─── TELECOMUNICAÇÕES ─────────────────────────────────────────────────────────
  telecomunicacoes: {
    setor: 'telecomunicacoes',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 61 — Telecomunicações (telefonia, TV por assinatura, internet banda larga, rádio). Regime específico com alíquota diferenciada na LC 214/2025 — percentual exato ainda depende de regulamentação complementar do CGIBS. Tratamento separado do setor de TI/tecnologia.',
  },

  // ─── TECNOLOGIA ───────────────────────────────────────────────────────────────
  tecnologia: {
    setor: 'tecnologia',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'CNAE 58–60/62–63 — Software, desenvolvimento de sistemas, SaaS, TI em geral. Regime padrão sem redução específica. Impacto relevante: empresas que hoje pagam ISS (2%–5%) podem ter aumento significativo para ~26,5% com créditos a partir de 2027. Exceção: profissionais liberais de TI constituídos como PJ têm 30% de redução (ver sub-tipo). Telecom (CNAE 61): regime específico diferenciado.',
  },

  // ─── ATIVIDADES DESPORTIVAS E RECREATIVAS ─────────────────────────────────────
  entidades_desportivas: {
    setor: 'entidades_desportivas',
    reducaoPercentual: 60,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 93 (exceto 9321) — Entidades desportivas profissionais e amadoras, clubes, academias, atividades desportivas em geral. Redução de 60% nas alíquotas de CBS e IBS — LC 214/2025.',
  },

  // ─── ENTIDADES RELIGIOSAS ─────────────────────────────────────────────────────
  entidades_religiosas: {
    setor: 'entidades_religiosas',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'especial',
    observacao: 'CNAE 94 — Igrejas, templos e entidades religiosas. Regime específico previsto na LC 214/2025 — tratamento diferenciado ainda aguarda regulamentação complementar detalhada pelo CGIBS. Entidades sem fins econômicos têm imunidade/isenção sobre contribuições associativas estatutárias (art. 5º, XII LC 214/2025, incluído pela LC 227/2026).',
    uiOnly: true,
  },

  // ─── MISTO ────────────────────────────────────────────────────────────────────
  misto: {
    setor: 'misto',
    reducaoPercentual: 0,
    sujetoImpSeletivo: false,
    regime: 'padrao',
    observacao: 'Atividade mista ou não classificada — aplica-se alíquota padrão (análise individualizada recomendada pelo contador)',
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
