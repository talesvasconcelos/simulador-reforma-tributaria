import * as cheerio from 'cheerio'
import { anthropic } from './client'
import { db } from '@/lib/db'
import { novidades } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { indexarDocumento } from '@/lib/rag/indexar'

interface FonteNovidade {
  url: string
  tipo: 'instrucao_normativa' | 'resolucao_comite_gestor' | 'diario_oficial' | 'portaria' | 'solucao_consulta' | 'noticia'
  nome: string
}

// Fontes monitoradas para novidades da reforma tributária
const FONTES: FonteNovidade[] = [
  {
    url: 'https://www.gov.br/receitafederal/pt-br/assuntos/noticias',
    tipo: 'instrucao_normativa',
    nome: 'Receita Federal',
  },
  {
    url: 'https://www.gov.br/fazenda/pt-br/assuntos/noticias',
    tipo: 'noticia',
    nome: 'Ministério da Fazenda',
  },
]

async function fetchConteudo(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; SimuladorReformaTributaria/1.0)',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status} ao acessar ${url}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  // Remover scripts, estilos e elementos de navegação
  $('script, style, nav, header, footer, aside').remove()

  // Extrair texto principal
  return $('main, article, .content, #content, body')
    .first()
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000) // Limitar tamanho
}

interface ClassificacaoNovidade {
  titulo: string
  resumo: string
  nivelImpacto: 'alto' | 'medio' | 'baixo'
  impactaSetores: string[]
  impactaRegimes: string[]
  palavrasChave: string[]
  ehLegislacao: boolean
}

async function classificarNovidade(
  titulo: string,
  conteudo: string,
  tipo: string
): Promise<ClassificacaoNovidade> {
  const resposta = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Analise esta notícia/documento sobre a Reforma Tributária brasileira e classifique:

Tipo: ${tipo}
Título: ${titulo}
Conteúdo: ${conteudo}

Retorne JSON com:
{
  "titulo": "título conciso e informativo",
  "resumo": "resumo em 2-3 frases do impacto prático",
  "nivelImpacto": "alto" | "medio" | "baixo",
  "impactaSetores": ["setor1", "setor2"],
  "impactaRegimes": ["regime1", "regime2"],
  "palavrasChave": ["palavra1", "palavra2"],
  "ehLegislacao": true | false
}

Retorne apenas JSON válido, sem markdown.`,
      },
    ],
  })

  const texto = resposta.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('')

  return JSON.parse(texto)
}

/**
 * Monitora fontes externas, classifica novas publicações e as salva no banco.
 * Chamado pelo cron job diário.
 */
export async function atualizarNovidades(): Promise<{ novas: number; erros: number }> {
  let novas = 0
  let erros = 0

  for (const fonte of FONTES) {
    try {
      const conteudo = await fetchConteudo(fonte.url)

      const classificacao = await classificarNovidade(
        fonte.nome,
        conteudo,
        fonte.tipo
      )

      // Verificar duplicata pela URL
      const existente = await db.query.novidades.findFirst({
        where: eq(novidades.urlOriginal, fonte.url),
      })

      if (!existente) {
        await db.insert(novidades).values({
          titulo: classificacao.titulo,
          resumo: classificacao.resumo,
          conteudoCompleto: conteudo,
          fonte: fonte.nome,
          urlOriginal: fonte.url,
          tipo: fonte.tipo,
          dataPublicacao: new Date(),
          impactaSetores: classificacao.impactaSetores,
          impactaRegimes: classificacao.impactaRegimes,
          nivelImpacto: classificacao.nivelImpacto,
          palavrasChave: classificacao.palavrasChave,
        })

        // Se for legislação, indexar na base RAG para o chat
        if (classificacao.ehLegislacao && conteudo.length > 500) {
          await indexarDocumento({
            titulo: classificacao.titulo,
            fonte: fonte.nome,
            conteudo,
            tipoDocumento: fonte.tipo,
            url: fonte.url,
            dataPublicacao: new Date(),
          }).catch((err) => {
            console.error(`Erro ao indexar legislação ${fonte.url}:`, err)
          })
        }

        novas++
      }
    } catch (error) {
      console.error(`Erro ao processar fonte ${fonte.url}:`, error)
      erros++
    }
  }

  return { novas, erros }
}
