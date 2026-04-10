import { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { fornecedores, filaEnriquecimento } from '@/lib/db/schema'

export type Fornecedor = InferSelectModel<typeof fornecedores>
export type NovoFornecedor = InferInsertModel<typeof fornecedores>

export type FilaEnriquecimento = InferSelectModel<typeof filaEnriquecimento>

export interface FornecedorImportado {
  cnpj: string
  nomeErp?: string
  codigoErp?: string
  valorMedioComprasMensal?: number
  categoriaCompra?: string
}

export interface ResultadoImportacao {
  total: number
  inseridos: number
  duplicatas: number
  erros: number
  cnpjsInvalidos: string[]
}

export interface ProgressoEnriquecimento {
  total: number
  pendente: number
  emProcessamento: number
  concluido: number
  erro: number
  percentualConcluido: number
}

export interface AnaliseEstrategica {
  fornecedorId: string
  cnpj: string
  nome: string
  regime: string
  setor: string
  precoMedioMensal: number
  percentualCredito: number
  creditoMensal: number
  creditoPotencialMensal: number   // Crédito que seria obtido se comprador fosse Lucro Real/Presumido
  custoEfetivo: number
  economia: number
  recomendacao: 'manter' | 'renegociar' | 'avaliar_substituto'
  creditoVedado?: boolean
}
