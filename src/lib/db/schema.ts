import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core'

// ============================================================
// ENUMS
// ============================================================

export const regimeTributarioEnum = pgEnum('regime_tributario', [
  'simples_nacional',
  'mei',
  'lucro_presumido',
  'lucro_real',
  'nanoempreendedor',
  'isento',
  'nao_identificado',
])

export const setorEnum = pgEnum('setor', [
  'industria',
  'comercio_atacado',
  'comercio_varejo',
  'servicos',
  'servicos_saude',
  'servicos_educacao',
  'servicos_financeiros',
  'agronegocio',
  'construcao_civil',
  'transporte',
  'tecnologia',
  'misto',
])

export const statusEnriquecimentoEnum = pgEnum('status_enriquecimento', [
  'pendente',
  'em_processamento',
  'concluido',
  'erro',
  'nao_encontrado',
])

export const tipoOperacaoEnum = pgEnum('tipo_operacao', [
  'venda_produto',
  'venda_servico',
  'compra_insumo',
  'compra_imobilizado',
  'importacao',
  'exportacao',
])

export const tipoNovidadeEnum = pgEnum('tipo_novidade', [
  'instrucao_normativa',
  'resolucao_comite_gestor',
  'diario_oficial',
  'portaria',
  'solucao_consulta',
  'noticia',
])

// ============================================================
// EMPRESAS — Perfil tributário da empresa cliente
// ============================================================

export const empresas = pgTable('empresas', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: varchar('organization_id', { length: 255 }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  // Dados básicos
  cnpj: varchar('cnpj', { length: 14 }).notNull(),
  razaoSocial: varchar('razao_social', { length: 500 }).notNull(),
  nomeFantasia: varchar('nome_fantasia', { length: 500 }),
  cnaePrincipal: varchar('cnae_principal', { length: 10 }),
  cnaesSecundarios: jsonb('cnaes_secundarios').$type<string[]>(),

  // Regime tributário
  regime: regimeTributarioEnum('regime').notNull(),
  setor: setorEnum('setor').notNull(),

  // Localização (impacta alíquota IBS)
  uf: varchar('uf', { length: 2 }).notNull(),
  municipio: varchar('municipio', { length: 200 }).notNull(),
  codigoIbge: varchar('codigo_ibge', { length: 7 }),

  // Dados financeiros para simulação
  faturamentoAnual: numeric('faturamento_anual', { precision: 18, scale: 2 }),
  percentualExportacao: numeric('percentual_exportacao', { precision: 5, scale: 2 }).default('0'),
  percentualImportacao: numeric('percentual_importacao', { precision: 5, scale: 2 }).default('0'),

  // Configurações do simulador
  aliquotaIcmsAtual: numeric('aliquota_icms_atual', { precision: 5, scale: 2 }),
  aliquotaIssAtual: numeric('aliquota_iss_atual', { precision: 5, scale: 2 }),
  percentualCreditoPisCofins: numeric('percentual_credito_pis_cofins', { precision: 5, scale: 2 }),

  // Setores especiais
  isExportadora: boolean('is_exportadora').default(false),
  isImune: boolean('is_imune').default(false),
  possuiBeneficioFiscal: boolean('possui_beneficio_fiscal').default(false),
  descricaoBeneficio: text('descricao_beneficio'),

  // Metadados
  criadoEm: timestamp('criado_em').defaultNow().notNull(),
  atualizadoEm: timestamp('atualizado_em').defaultNow().notNull(),
}, (table) => ({
  orgIdx: index('empresas_org_idx').on(table.organizationId),
  cnpjIdx: uniqueIndex('empresas_cnpj_idx').on(table.cnpj),
}))

// ============================================================
// FORNECEDORES — Importados do ERP
// ============================================================

export const fornecedores = pgTable('fornecedores', {
  id: uuid('id').defaultRandom().primaryKey(),
  empresaId: uuid('empresa_id').references(() => empresas.id, { onDelete: 'cascade' }).notNull(),

  // Dados do ERP
  cnpj: varchar('cnpj', { length: 14 }).notNull(),
  codigoErp: varchar('codigo_erp', { length: 100 }),
  nomeErp: varchar('nome_erp', { length: 500 }),

  // Dados enriquecidos (preenchidos pelo agente)
  razaoSocial: varchar('razao_social', { length: 500 }),
  nomeFantasia: varchar('nome_fantasia', { length: 500 }),
  regime: regimeTributarioEnum('regime'),
  setor: setorEnum('setor'),
  cnaeCodigoPrincipal: varchar('cnae_codigo_principal', { length: 10 }),
  cnaeDescricaoPrincipal: varchar('cnae_descricao_principal', { length: 500 }),
  uf: varchar('uf', { length: 2 }),
  municipio: varchar('municipio', { length: 200 }),
  porte: varchar('porte', { length: 50 }),
  situacaoCadastral: varchar('situacao_cadastral', { length: 50 }),

  // Dados calculados pelo simulador
  geraCredito: boolean('gera_credito'),
  percentualCreditoEstimado: numeric('percentual_credito_estimado', { precision: 5, scale: 2 }),
  sujetoImpSeletivo: boolean('sujeto_imp_seletivo').default(false),
  setorDiferenciadoReforma: boolean('setor_diferenciado_reforma').default(false),
  reducaoAliquota: numeric('reducao_aliquota', { precision: 5, scale: 2 }).default('0'),

  // Dados financeiros do relacionamento
  valorMedioComprasMensal: numeric('valor_medio_compras_mensal', { precision: 18, scale: 2 }),
  categoriaCompra: varchar('categoria_compra', { length: 200 }),

  // Status de enriquecimento
  statusEnriquecimento: statusEnriquecimentoEnum('status_enriquecimento').default('pendente').notNull(),
  ultimoEnriquecimentoEm: timestamp('ultimo_enriquecimento_em'),
  erroEnriquecimento: text('erro_enriquecimento'),

  // JSON completo da API de CNPJ (para consulta futura)
  dadosApiCnpj: jsonb('dados_api_cnpj'),

  // Metadados
  ativo: boolean('ativo').default(true),
  criadoEm: timestamp('criado_em').defaultNow().notNull(),
  atualizadoEm: timestamp('atualizado_em').defaultNow().notNull(),
}, (table) => ({
  empresaIdx: index('fornecedores_empresa_idx').on(table.empresaId),
  cnpjIdx: index('fornecedores_cnpj_idx').on(table.cnpj),
  statusIdx: index('fornecedores_status_idx').on(table.statusEnriquecimento),
  cnpjEmpresaIdx: uniqueIndex('fornecedores_cnpj_empresa_idx').on(table.cnpj, table.empresaId),
}))

// ============================================================
// SIMULAÇÕES — Histórico de simulações salvas
// ============================================================

export const simulacoes = pgTable('simulacoes', {
  id: uuid('id').defaultRandom().primaryKey(),
  empresaId: uuid('empresa_id').references(() => empresas.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  nome: varchar('nome', { length: 300 }),
  descricao: text('descricao'),
  anoSimulado: integer('ano_simulado').notNull(),
  tipoSimulacao: varchar('tipo_simulacao', { length: 50 }),

  parametrosEntrada: jsonb('parametros_entrada').notNull(),
  resultadoCalculado: jsonb('resultado_calculado').notNull(),

  cargaTributariaAtual: numeric('carga_tributaria_atual', { precision: 18, scale: 2 }),
  cargaTributariaFutura: numeric('carga_tributaria_futura', { precision: 18, scale: 2 }),
  variacaoPercentual: numeric('variacao_percentual', { precision: 7, scale: 2 }),

  criadoEm: timestamp('criado_em').defaultNow().notNull(),
}, (table) => ({
  empresaIdx: index('simulacoes_empresa_idx').on(table.empresaId),
  anoIdx: index('simulacoes_ano_idx').on(table.anoSimulado),
}))

// ============================================================
// OPERAÇÕES — Operações de venda/compra para simulação
// ============================================================

export const operacoes = pgTable('operacoes', {
  id: uuid('id').defaultRandom().primaryKey(),
  empresaId: uuid('empresa_id').references(() => empresas.id, { onDelete: 'cascade' }).notNull(),
  simulacaoId: uuid('simulacao_id').references(() => simulacoes.id, { onDelete: 'set null' }),

  descricao: varchar('descricao', { length: 500 }).notNull(),
  tipoOperacao: tipoOperacaoEnum('tipo_operacao').notNull(),
  valorOperacao: numeric('valor_operacao', { precision: 18, scale: 2 }).notNull(),
  ncm: varchar('ncm', { length: 10 }),
  cnae: varchar('cnae', { length: 10 }),

  fornecedorId: uuid('fornecedor_id').references(() => fornecedores.id),

  sujetoIsento: boolean('sujeto_isento').default(false),
  sujetoReducao: boolean('sujeto_reducao').default(false),
  percentualReducao: numeric('percentual_reducao', { precision: 5, scale: 2 }).default('0'),
  sujetoImpSeletivo: boolean('sujeto_imp_seletivo').default(false),

  ativo: boolean('ativo').default(true),
  criadoEm: timestamp('criado_em').defaultNow().notNull(),
}, (table) => ({
  empresaIdx: index('operacoes_empresa_idx').on(table.empresaId),
}))

// ============================================================
// RAG — Documentos legais indexados
// ============================================================

export const documentosRag = pgTable('documentos_rag', {
  id: uuid('id').defaultRandom().primaryKey(),

  titulo: varchar('titulo', { length: 500 }).notNull(),
  fonte: varchar('fonte', { length: 200 }).notNull(),
  url: varchar('url', { length: 1000 }),
  tipoDocumento: varchar('tipo_documento', { length: 100 }),
  dataPublicacao: timestamp('data_publicacao'),
  versao: varchar('versao', { length: 50 }),

  totalChunks: integer('total_chunks').default(0),
  indexadoEm: timestamp('indexado_em').defaultNow().notNull(),
  ativo: boolean('ativo').default(true),
})

export const embeddingsRag = pgTable('embeddings_rag', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentoId: uuid('documento_id').references(() => documentosRag.id, { onDelete: 'cascade' }).notNull(),

  chunkIndex: integer('chunk_index').notNull(),
  conteudo: text('conteudo').notNull(),
  embedding: text('embedding').notNull(), // Vetor como string JSON — usar com pgvector cast

  // Metadados do chunk para filtros
  artigos: jsonb('artigos').$type<string[]>(),
  palavrasChave: jsonb('palavras_chave').$type<string[]>(),
  setor: varchar('setor', { length: 100 }),

  criadoEm: timestamp('criado_em').defaultNow().notNull(),
}, (table) => ({
  documentoIdx: index('embeddings_documento_idx').on(table.documentoId),
}))

// ============================================================
// NOVIDADES — Feed de atualizações da reforma
// ============================================================

export const novidades = pgTable('novidades', {
  id: uuid('id').defaultRandom().primaryKey(),

  titulo: varchar('titulo', { length: 500 }).notNull(),
  resumo: text('resumo').notNull(),
  conteudoCompleto: text('conteudo_completo'),
  fonte: varchar('fonte', { length: 200 }).notNull(),
  urlOriginal: varchar('url_original', { length: 1000 }),
  tipo: tipoNovidadeEnum('tipo').notNull(),
  dataPublicacao: timestamp('data_publicacao').notNull(),

  // Classificação automática pelo agente
  impactaSetores: jsonb('impacta_setores').$type<string[]>(),
  impactaRegimes: jsonb('impacta_regimes').$type<string[]>(),
  nivelImpacto: varchar('nivel_impacto', { length: 20 }),
  palavrasChave: jsonb('palavras_chave').$type<string[]>(),

  processadoEm: timestamp('processado_em').defaultNow().notNull(),
  ativo: boolean('ativo').default(true),
}, (table) => ({
  dataIdx: index('novidades_data_idx').on(table.dataPublicacao),
  tipoIdx: index('novidades_tipo_idx').on(table.tipo),
}))

// ============================================================
// CHAT — Histórico de conversas com o agente
// ============================================================

export const chatHistorico = pgTable('chat_historico', {
  id: uuid('id').defaultRandom().primaryKey(),
  empresaId: uuid('empresa_id').references(() => empresas.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  sessionId: uuid('session_id').defaultRandom().notNull(),

  role: varchar('role', { length: 20 }).notNull(), // 'user' | 'assistant'
  conteudo: text('conteudo').notNull(),

  chunksUsados: jsonb('chunks_usados').$type<string[]>(),
  documentosFonte: jsonb('documentos_fonte').$type<string[]>(),

  tokens: integer('tokens'),
  criadoEm: timestamp('criado_em').defaultNow().notNull(),
}, (table) => ({
  empresaIdx: index('chat_empresa_idx').on(table.empresaId),
  sessionIdx: index('chat_session_idx').on(table.sessionId),
}))

// ============================================================
// FILA DE ENRIQUECIMENTO — Controle dos jobs de CNPJ
// ============================================================

export const filaEnriquecimento = pgTable('fila_enriquecimento', {
  id: uuid('id').defaultRandom().primaryKey(),
  empresaId: uuid('empresa_id').references(() => empresas.id, { onDelete: 'cascade' }).notNull(),
  fornecedorId: uuid('fornecedor_id').references(() => fornecedores.id, { onDelete: 'cascade' }).notNull(),
  cnpj: varchar('cnpj', { length: 14 }).notNull(),

  status: statusEnriquecimentoEnum('status').default('pendente').notNull(),
  tentativas: integer('tentativas').default(0),
  ultimaTentativaEm: timestamp('ultima_tentativa_em'),
  erroDetalhado: text('erro_detalhado'),
  prioridade: integer('prioridade').default(5),

  criadoEm: timestamp('criado_em').defaultNow().notNull(),
  concluidoEm: timestamp('concluido_em'),
}, (table) => ({
  statusIdx: index('fila_status_idx').on(table.status),
  cnpjIdx: index('fila_cnpj_idx').on(table.cnpj),
}))
