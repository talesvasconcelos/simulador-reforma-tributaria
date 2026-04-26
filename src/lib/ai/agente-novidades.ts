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
        content: `Analise este conteúdo extraído de portal governamental sobre a Reforma Tributária brasileira e classifique:

Tipo: ${tipo}
Fonte: ${titulo}
Conteúdo: ${conteudo}

Retorne JSON com:
{
  "titulo": "título conciso e informativo descrevendo as principais novidades encontradas",
  "resumo": "resumo em 2-3 frases do impacto prático para empresas",
  "nivelImpacto": "alto" | "medio" | "baixo",
  "impactaSetores": ["setor1", "setor2"],
  "impactaRegimes": ["regime1", "regime2"],
  "palavrasChave": ["palavra1", "palavra2"],
  "ehLegislacao": true | false
}

Retorne apenas JSON válido, sem markdown, sem texto adicional.`,
      },
    ],
  })

  const texto = resposta.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  // Remover possível markdown ```json ... ``` que Claude às vezes adiciona
  const jsonLimpo = texto.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    return JSON.parse(jsonLimpo)
  } catch {
    // Fallback se Claude não retornar JSON válido
    console.warn('[novidades] Resposta Claude não é JSON válido, usando fallback')
    return {
      titulo: `Atualização tributária — ${titulo}`,
      resumo: conteudo.slice(0, 300),
      nivelImpacto: 'baixo',
      impactaSetores: [],
      impactaRegimes: [],
      palavrasChave: [],
      ehLegislacao: false,
    }
  }
}

// Palavras irrelevantes para comparação de títulos (português)
const STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'do', 'da', 'dos', 'das',
  'em', 'no', 'na', 'nos', 'nas', 'por', 'para', 'com', 'sem', 'que',
  'e', 'é', 'ao', 'aos', 'à', 'às', 'se', 'ou', 'mas', 'não', 'mais',
])

function palavrasSignificativas(texto: string): Set<string> {
  return new Set(
    texto.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
      .split(/\s+/)
      .filter((p) => p.length > 3 && !STOP_WORDS.has(p))
  )
}

function saoSimilares(a: ClassificacaoNovidade, b: ClassificacaoNovidade): boolean {
  // Overlap de palavras-chave: 3 ou mais em comum → mesma notícia
  const kwA = new Set(a.palavrasChave.map((k) => k.toLowerCase()))
  const kwB = new Set(b.palavrasChave.map((k) => k.toLowerCase()))
  const overlapKw = [...kwA].filter((k) => kwB.has(k)).length
  if (overlapKw >= 3) return true

  // Overlap de palavras significativas do título: 3 ou mais → mesma notícia
  const titA = palavrasSignificativas(a.titulo)
  const titB = palavrasSignificativas(b.titulo)
  const overlapTit = [...titA].filter((p) => titB.has(p)).length
  if (overlapTit >= 3) return true

  return false
}

/**
 * Monitora fontes externas, classifica novas publicações e as salva no banco.
 * Chamado pelo cron job diário.
 */
export async function atualizarNovidades(): Promise<{ novas: number; erros: number }> {
  let novas = 0
  let erros = 0

  const hoje = new Date().toISOString().slice(0, 10) // "2026-04-11"

  // Fase 1: buscar e classificar todas as fontes antes de salvar qualquer coisa
  type Candidata = {
    fonte: FonteNovidade
    classificacao: ClassificacaoNovidade
    conteudo: string
    chaveDedup: string
  }
  const candidatas: Candidata[] = []

  for (const fonte of FONTES) {
    try {
      const conteudo = await fetchConteudo(fonte.url)

      if (!conteudo || conteudo.length < 100) {
        console.warn(`[novidades] Conteúdo insuficiente de ${fonte.url} (${conteudo?.length ?? 0} chars)`)
        erros++
        continue
      }

      const classificacao = await classificarNovidade(fonte.nome, conteudo, fonte.tipo)
      candidatas.push({ fonte, classificacao, conteudo, chaveDedup: `${fonte.url}#${hoje}` })
    } catch (error) {
      console.error(`[novidades] Erro ao processar ${fonte.url}:`, error)
      erros++
    }
  }

  // Fase 2: remover duplicatas entre fontes (mesma notícia publicada por dois portais)
  const unicas = candidatas.filter((item, idx) =>
    !candidatas.slice(0, idx).some((anterior) => saoSimilares(item.classificacao, anterior.classificacao))
  )

  const duplicatasRemovidas = candidatas.length - unicas.length
  if (duplicatasRemovidas > 0) {
    console.log(`[novidades] ${duplicatasRemovidas} notícia(s) duplicada(s) entre fontes removida(s)`)
  }

  // Fase 3: salvar apenas as únicas que ainda não existem no banco
  for (const { fonte, classificacao, conteudo, chaveDedup } of unicas) {
    try {
      const existente = await db.query.novidades.findFirst({
        where: eq(novidades.urlOriginal, chaveDedup),
      })

      if (!existente) {
        await db.insert(novidades).values({
          titulo: classificacao.titulo,
          resumo: classificacao.resumo,
          conteudoCompleto: conteudo,
          fonte: fonte.nome,
          urlOriginal: chaveDedup,
          tipo: fonte.tipo,
          dataPublicacao: new Date(),
          impactaSetores: classificacao.impactaSetores,
          impactaRegimes: classificacao.impactaRegimes,
          nivelImpacto: classificacao.nivelImpacto,
          palavrasChave: classificacao.palavrasChave,
        })

        if (classificacao.ehLegislacao && conteudo.length > 500) {
          await indexarDocumento({
            titulo: classificacao.titulo,
            fonte: fonte.nome,
            conteudo,
            tipoDocumento: fonte.tipo,
            url: fonte.url,
            dataPublicacao: new Date(),
          }).catch((err) => {
            console.error(`[novidades] Erro ao indexar legislação ${fonte.url}:`, err)
          })
        }

        novas++
        console.log(`[novidades] Nova: "${classificacao.titulo}" (${fonte.nome})`)
      }
    } catch (error) {
      console.error(`[novidades] Erro ao salvar novidade de ${fonte.url}:`, error)
      erros++
    }
  }

  return { novas, erros }
}
