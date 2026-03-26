import { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { empresas, fornecedores, simulacoes, operacoes } from '@/lib/db/schema'

export type Empresa = InferSelectModel<typeof empresas>
export type NovaEmpresa = InferInsertModel<typeof empresas>

export type Fornecedor = InferSelectModel<typeof fornecedores>
export type NovoFornecedor = InferInsertModel<typeof fornecedores>

export type Simulacao = InferSelectModel<typeof simulacoes>
export type NovaSimulacao = InferInsertModel<typeof simulacoes>

export type Operacao = InferSelectModel<typeof operacoes>
export type NovaOperacao = InferInsertModel<typeof operacoes>
