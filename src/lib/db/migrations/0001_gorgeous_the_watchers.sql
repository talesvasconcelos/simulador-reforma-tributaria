ALTER TYPE "public"."setor" ADD VALUE 'hotelaria';--> statement-breakpoint
ALTER TYPE "public"."setor" ADD VALUE 'parques_diversao';--> statement-breakpoint
ALTER TYPE "public"."setor" ADD VALUE 'fii_fiagro';--> statement-breakpoint
ALTER TYPE "public"."setor" ADD VALUE 'telecomunicacoes';--> statement-breakpoint
ALTER TYPE "public"."setor" ADD VALUE 'entidades_desportivas';--> statement-breakpoint
ALTER TYPE "public"."setor" ADD VALUE 'entidades_religiosas';--> statement-breakpoint
CREATE TABLE "aprovacoes_pendentes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"solicitante_id" varchar(255) NOT NULL,
	"acao" varchar(100) NOT NULL,
	"descricao_acao" varchar(500) NOT NULL,
	"token" varchar(100) NOT NULL,
	"status" varchar(30) DEFAULT 'pendente' NOT NULL,
	"aprovador_id" varchar(255),
	"dados_acao" jsonb,
	"expirado_em" timestamp NOT NULL,
	"resolvido_em" timestamp,
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"acao" varchar(100) NOT NULL,
	"recurso" varchar(100) NOT NULL,
	"detalhes" jsonb,
	"ip" varchar(45),
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ip_permitidos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"ip" varchar(50) NOT NULL,
	"descricao" varchar(200),
	"criado_em" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "embeddings_rag" ADD COLUMN "embedding_vector" vector(1024);--> statement-breakpoint
CREATE INDEX "aprovacoes_org_idx" ON "aprovacoes_pendentes" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "aprovacoes_token_idx" ON "aprovacoes_pendentes" USING btree ("token");--> statement-breakpoint
CREATE INDEX "aprovacoes_status_idx" ON "aprovacoes_pendentes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "auditoria_org_idx" ON "auditoria" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "auditoria_criado_idx" ON "auditoria" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "ip_permitidos_org_idx" ON "ip_permitidos" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "fornecedores_empresa_ativo_idx" ON "fornecedores" USING btree ("empresa_id","ativo");--> statement-breakpoint
CREATE INDEX "fornecedores_empresa_status_ativo_idx" ON "fornecedores" USING btree ("empresa_id","status_enriquecimento","ativo");