CREATE TYPE "public"."regime_tributario" AS ENUM('simples_nacional', 'mei', 'lucro_presumido', 'lucro_real', 'nanoempreendedor', 'isento', 'nao_identificado');--> statement-breakpoint
CREATE TYPE "public"."setor" AS ENUM('industria', 'comercio_atacado', 'comercio_varejo', 'servicos', 'profissionais_liberais', 'servicos_saude', 'servicos_educacao', 'servicos_financeiros', 'agronegocio', 'construcao_civil', 'construcao_edificios', 'construcao_infraestrutura', 'construcao_servicos_especializados', 'transporte', 'transporte_coletivo_passageiros', 'transporte_cargas', 'imoveis', 'combustiveis_energia', 'tecnologia', 'misto');--> statement-breakpoint
CREATE TYPE "public"."status_enriquecimento" AS ENUM('pendente', 'em_processamento', 'concluido', 'erro', 'nao_encontrado');--> statement-breakpoint
CREATE TYPE "public"."tipo_novidade" AS ENUM('instrucao_normativa', 'resolucao_comite_gestor', 'diario_oficial', 'portaria', 'solucao_consulta', 'noticia');--> statement-breakpoint
CREATE TYPE "public"."tipo_operacao" AS ENUM('venda_produto', 'venda_servico', 'compra_insumo', 'compra_imobilizado', 'importacao', 'exportacao');--> statement-breakpoint
CREATE TABLE "chat_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"session_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"role" varchar(20) NOT NULL,
	"conteudo" text NOT NULL,
	"chunks_usados" jsonb,
	"documentos_fonte" jsonb,
	"tokens" integer,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos_rag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" varchar(500) NOT NULL,
	"fonte" varchar(200) NOT NULL,
	"url" varchar(1000),
	"tipo_documento" varchar(100),
	"data_publicacao" timestamp,
	"versao" varchar(50),
	"total_chunks" integer DEFAULT 0,
	"indexado_em" timestamp DEFAULT now() NOT NULL,
	"ativo" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "embeddings_rag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"conteudo" text NOT NULL,
	"embedding" text NOT NULL,
	"artigos" jsonb,
	"palavras_chave" jsonb,
	"setor" varchar(100),
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"razao_social" varchar(500) NOT NULL,
	"nome_fantasia" varchar(500),
	"cnae_principal" varchar(10),
	"cnaes_secundarios" jsonb,
	"regime" "regime_tributario" NOT NULL,
	"setor" "setor" NOT NULL,
	"uf" varchar(2) NOT NULL,
	"municipio" varchar(200) NOT NULL,
	"codigo_ibge" varchar(7),
	"faturamento_anual" numeric(18, 2),
	"percentual_exportacao" numeric(5, 2) DEFAULT '0',
	"percentual_importacao" numeric(5, 2) DEFAULT '0',
	"aliquota_icms_atual" numeric(5, 2),
	"aliquota_iss_atual" numeric(5, 2),
	"percentual_credito_pis_cofins" numeric(5, 2),
	"is_exportadora" boolean DEFAULT false,
	"is_imune" boolean DEFAULT false,
	"possui_beneficio_fiscal" boolean DEFAULT false,
	"descricao_beneficio" text,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faturamento_mensal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"competencia" varchar(7) NOT NULL,
	"ano_referencia" integer NOT NULL,
	"valor_total" numeric(18, 2) NOT NULL,
	"valor_b2b" numeric(18, 2),
	"valor_publico" numeric(18, 2),
	"valor_b2c" numeric(18, 2),
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fila_enriquecimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"fornecedor_id" uuid NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"status" "status_enriquecimento" DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0,
	"ultima_tentativa_em" timestamp,
	"erro_detalhado" text,
	"prioridade" integer DEFAULT 5,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"concluido_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "fornecedores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cnpj" varchar(14) NOT NULL,
	"codigo_erp" varchar(100),
	"nome_erp" varchar(500),
	"razao_social" varchar(500),
	"nome_fantasia" varchar(500),
	"regime" "regime_tributario",
	"setor" "setor",
	"cnae_codigo_principal" varchar(10),
	"cnae_descricao_principal" varchar(500),
	"uf" varchar(2),
	"municipio" varchar(200),
	"porte" varchar(50),
	"situacao_cadastral" varchar(50),
	"gera_credito" boolean,
	"percentual_credito_estimado" numeric(5, 2),
	"sujeto_imp_seletivo" boolean DEFAULT false,
	"setor_diferenciado_reforma" boolean DEFAULT false,
	"reducao_aliquota" numeric(5, 2) DEFAULT '0',
	"valor_medio_compras_mensal" numeric(18, 2),
	"preco_referencia" numeric(18, 2),
	"categoria_compra" varchar(200),
	"opcao_cbs_ibs_por_fora" boolean DEFAULT false,
	"status_enriquecimento" "status_enriquecimento" DEFAULT 'pendente' NOT NULL,
	"ultimo_enriquecimento_em" timestamp,
	"erro_enriquecimento" text,
	"dados_api_cnpj" jsonb,
	"ativo" boolean DEFAULT true,
	"criado_em" timestamp DEFAULT now() NOT NULL,
	"atualizado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" varchar(500) NOT NULL,
	"resumo" text NOT NULL,
	"conteudo_completo" text,
	"fonte" varchar(200) NOT NULL,
	"url_original" varchar(1000),
	"tipo" "tipo_novidade" NOT NULL,
	"data_publicacao" timestamp NOT NULL,
	"impacta_setores" jsonb,
	"impacta_regimes" jsonb,
	"nivel_impacto" varchar(20),
	"palavras_chave" jsonb,
	"processado_em" timestamp DEFAULT now() NOT NULL,
	"ativo" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "operacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"simulacao_id" uuid,
	"descricao" varchar(500) NOT NULL,
	"tipo_operacao" "tipo_operacao" NOT NULL,
	"valor_operacao" numeric(18, 2) NOT NULL,
	"ncm" varchar(10),
	"cnae" varchar(10),
	"fornecedor_id" uuid,
	"sujeto_isento" boolean DEFAULT false,
	"sujeto_reducao" boolean DEFAULT false,
	"percentual_reducao" numeric(5, 2) DEFAULT '0',
	"sujeto_imp_seletivo" boolean DEFAULT false,
	"ativo" boolean DEFAULT true,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"nome" varchar(300),
	"descricao" text,
	"ano_simulado" integer NOT NULL,
	"tipo_simulacao" varchar(50),
	"parametros_entrada" jsonb NOT NULL,
	"resultado_calculado" jsonb NOT NULL,
	"carga_tributaria_atual" numeric(18, 2),
	"carga_tributaria_futura" numeric(18, 2),
	"variacao_percentual" numeric(7, 2),
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_historico" ADD CONSTRAINT "chat_historico_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings_rag" ADD CONSTRAINT "embeddings_rag_documento_id_documentos_rag_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos_rag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faturamento_mensal" ADD CONSTRAINT "faturamento_mensal_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fila_enriquecimento" ADD CONSTRAINT "fila_enriquecimento_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fila_enriquecimento" ADD CONSTRAINT "fila_enriquecimento_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fornecedores" ADD CONSTRAINT "fornecedores_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operacoes" ADD CONSTRAINT "operacoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operacoes" ADD CONSTRAINT "operacoes_simulacao_id_simulacoes_id_fk" FOREIGN KEY ("simulacao_id") REFERENCES "public"."simulacoes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operacoes" ADD CONSTRAINT "operacoes_fornecedor_id_fornecedores_id_fk" FOREIGN KEY ("fornecedor_id") REFERENCES "public"."fornecedores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulacoes" ADD CONSTRAINT "simulacoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_empresa_idx" ON "chat_historico" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "chat_session_idx" ON "chat_historico" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "embeddings_documento_idx" ON "embeddings_rag" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "empresas_org_idx" ON "empresas" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "empresas_cnpj_idx" ON "empresas" USING btree ("cnpj");--> statement-breakpoint
CREATE UNIQUE INDEX "fat_mensal_empresa_competencia_idx" ON "faturamento_mensal" USING btree ("empresa_id","competencia");--> statement-breakpoint
CREATE INDEX "fat_mensal_empresa_idx" ON "faturamento_mensal" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "fat_mensal_ano_idx" ON "faturamento_mensal" USING btree ("ano_referencia");--> statement-breakpoint
CREATE INDEX "fila_status_idx" ON "fila_enriquecimento" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fila_cnpj_idx" ON "fila_enriquecimento" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "fornecedores_empresa_idx" ON "fornecedores" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "fornecedores_cnpj_idx" ON "fornecedores" USING btree ("cnpj");--> statement-breakpoint
CREATE INDEX "fornecedores_status_idx" ON "fornecedores" USING btree ("status_enriquecimento");--> statement-breakpoint
CREATE UNIQUE INDEX "fornecedores_cnpj_empresa_idx" ON "fornecedores" USING btree ("cnpj","empresa_id");--> statement-breakpoint
CREATE INDEX "novidades_data_idx" ON "novidades" USING btree ("data_publicacao");--> statement-breakpoint
CREATE INDEX "novidades_tipo_idx" ON "novidades" USING btree ("tipo");--> statement-breakpoint
CREATE INDEX "operacoes_empresa_idx" ON "operacoes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "simulacoes_empresa_idx" ON "simulacoes" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX "simulacoes_ano_idx" ON "simulacoes" USING btree ("ano_simulado");