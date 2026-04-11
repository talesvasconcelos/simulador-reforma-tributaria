import { anthropic } from './client'
import type { ContextoChat } from '@/types/agente'

const SYSTEM_PROMPT_RAG = `Você é um especialista em Reforma Tributária Brasileira — EC 132/2023 e LC 214/2025.

Seu papel é responder perguntas de empresários e contadores sobre o impacto da reforma nas suas operações.

**Contexto da empresa:**
{PERFIL_EMPRESA}

**Legislação relevante recuperada:**
{CHUNKS_LEGISLACAO}

**Diretrizes:**
- Responda com base nas leis citadas, especificando os artigos quando relevante
- Adapte a resposta ao regime e setor da empresa (contexto acima)
- Use linguagem clara e acessível para um empresário, sem jargão excessivo
- Se não tiver certeza, indique que é necessário consultar um contador/advogado tributarista
- Cite sempre as fontes legais usadas (ex: "Conforme Art. 5º da LC 214/2025...")
- Formate a resposta em Markdown para facilitar a leitura`

/**
 * Agente de dúvidas com RAG — responde perguntas sobre a reforma tributária
 * com contexto da legislação indexada e perfil da empresa.
 *
 * Os chunks já foram buscados pelo route antes de chamar esta função.
 * Não chamamos buscarChunksSimilares aqui — evita double call à Voyage AI.
 */
export async function* consultarAgente(
  pergunta: string,
  contexto: ContextoChat
): AsyncGenerator<string> {
  // 1. Usar chunks já buscados pelo route (contexto.chunks)
  const chunks = contexto.chunks

  // 2. Montar contexto da legislação
  const legislacaoContexto = chunks
    .map((c, i) => `[Fonte ${i + 1} — ${c.fonte}]\n${c.conteudo}`)
    .join('\n\n---\n\n')

  // 3. Montar perfil da empresa
  const perfilEmpresa = `
- Regime: ${contexto.empresa.regime}
- Setor: ${contexto.empresa.setor}
- UF: ${contexto.empresa.uf}
- Município: ${contexto.empresa.municipio}
${contexto.empresa.faturamentoAnual ? `- Faturamento anual: R$ ${Number(contexto.empresa.faturamentoAnual).toLocaleString('pt-BR')}` : ''}
`.trim()

  // 4. Montar histórico das últimas mensagens
  const historico = contexto.historico
    .slice(-10) // Últimas 5 trocas (10 mensagens)
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.conteudo,
    }))

  // 5. Preparar system prompt
  const systemPrompt = SYSTEM_PROMPT_RAG
    .replace('{PERFIL_EMPRESA}', perfilEmpresa)
    .replace('{CHUNKS_LEGISLACAO}', legislacaoContexto || 'Nenhum trecho relevante encontrado na base legal.')

  // 6. Stream da resposta
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      ...historico,
      { role: 'user', content: pergunta },
    ],
  })

  for await (const chunk of stream) {
    if (
      chunk.type === 'content_block_delta' &&
      chunk.delta.type === 'text_delta'
    ) {
      yield chunk.delta.text
    }
  }
}
