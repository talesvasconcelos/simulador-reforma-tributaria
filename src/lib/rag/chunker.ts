import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'

// Separadores jurídicos para chunking de legislação brasileira
const SEPARADORES_JURIDICOS = [
  'Art.',
  'Parágrafo',
  '§',
  '\n\n',
  '\n',
  ' ',
  '',
]

/**
 * Divide um documento jurídico em chunks otimizados para busca semântica.
 * Usa separadores específicos para textos legais brasileiros.
 */
export async function dividirEmChunks(texto: string): Promise<string[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 100,
    separators: SEPARADORES_JURIDICOS,
  })

  const chunks = await splitter.splitText(texto)

  // Filtrar chunks muito pequenos (menos de 50 caracteres)
  return chunks.filter((chunk) => chunk.trim().length >= 50)
}

/**
 * Extrai artigos referenciados no chunk para metadados de busca.
 */
export function extrairArtigos(texto: string): string[] {
  const regex = /Art\.?\s*(\d+[°º]?(?:-[A-Z])?)/gi
  const matches = texto.match(regex) ?? []
  return [...new Set(matches.map((m) => m.trim()))]
}

/**
 * Extrai palavras-chave tributárias relevantes para filtros.
 */
export function extrairPalavrasChave(texto: string): string[] {
  const termos = [
    'CBS', 'IBS', 'IS', 'PIS', 'COFINS', 'ICMS', 'ISS', 'IPI',
    'Simples Nacional', 'Lucro Real', 'Lucro Presumido', 'MEI',
    'alíquota', 'crédito', 'isenção', 'redução', 'base de cálculo',
    'não-cumulatividade', 'imunidade', 'exportação', 'importação',
    'CNPJ', 'reforma tributária', 'LC 214', 'EC 132',
  ]

  const textoUpper = texto.toUpperCase()
  return termos.filter((termo) => textoUpper.includes(termo.toUpperCase()))
}
