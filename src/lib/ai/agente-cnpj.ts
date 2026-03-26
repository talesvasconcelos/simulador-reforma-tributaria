import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { fornecedores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Tool para consulta BrasilAPI
const ferramentaBrasilApi = {
  name: 'consultar_cnpj_brasil_api',
  description:
    'Consulta dados de um CNPJ na BrasilAPI (Receita Federal). Retorna razão social, CNAE, porte, situação cadastral e se é optante do Simples Nacional.',
  input_schema: {
    type: 'object' as const,
    properties: {
      cnpj: {
        type: 'string',
        description: 'CNPJ com 14 dígitos numéricos, sem formatação',
      },
    },
    required: ['cnpj'],
  },
}

// Tool para consulta ReceitaWS (fallback)
const ferramentaReceitaWS = {
  name: 'consultar_cnpj_receita_ws',
  description: 'Consulta alternativa na ReceitaWS. Usar apenas se BrasilAPI falhar.',
  input_schema: {
    type: 'object' as const,
    properties: {
      cnpj: {
        type: 'string',
        description: 'CNPJ com 14 dígitos numéricos',
      },
    },
    required: ['cnpj'],
  },
}

async function executarFerramenta(nome: string, input: { cnpj: string }): Promise<object> {
  const { cnpj } = input

  if (nome === 'consultar_cnpj_brasil_api') {
    const res = await fetch(`${process.env.BRASIL_API_URL}/${cnpj}`, {
      next: { revalidate: 86400 }, // Cache 24h
    } as RequestInit)
    if (!res.ok) throw new Error(`BrasilAPI error: ${res.status}`)
    return res.json()
  }

  if (nome === 'consultar_cnpj_receita_ws') {
    // Rate limit: 3 req/min no plano free
    await new Promise((r) => setTimeout(r, 20000))
    const res = await fetch(`${process.env.RECEITA_WS_URL}/${cnpj}`)
    if (!res.ok) throw new Error(`ReceitaWS error: ${res.status}`)
    return res.json()
  }

  throw new Error(`Ferramenta desconhecida: ${nome}`)
}

const SYSTEM_PROMPT_ENRIQUECEDOR = `Você é um especialista em tributação brasileira e classificação de empresas.

Sua tarefa é:
1. Consultar os dados de um CNPJ usando as ferramentas disponíveis
2. Analisar os dados retornados
3. Classificar a empresa conforme a Reforma Tributária (LC 214/2025)

Retorne SEMPRE um JSON válido com esta estrutura exata:
{
  "razao_social": string,
  "nome_fantasia": string | null,
  "regime": "simples_nacional" | "mei" | "lucro_presumido" | "lucro_real" | "nanoempreendedor" | "isento" | "nao_identificado",
  "setor": "industria" | "comercio_atacado" | "comercio_varejo" | "servicos" | "servicos_saude" | "servicos_educacao" | "servicos_financeiros" | "agronegocio" | "construcao_civil" | "transporte" | "tecnologia" | "misto",
  "cnae_codigo": string,
  "cnae_descricao": string,
  "uf": string,
  "municipio": string,
  "porte": "MEI" | "ME" | "EPP" | "MEDIO" | "GRANDE" | "NAO_INFORMADO",
  "situacao_cadastral": string,
  "gera_credito": boolean,
  "percentual_credito_estimado": number,
  "sujeto_imposto_seletivo": boolean,
  "setor_diferenciado_reforma": boolean,
  "reducao_aliquota_percentual": number,
  "justificativa_classificacao": string
}

Regras de classificação para a Reforma Tributária:
- Simples Nacional / MEI: NÃO gera crédito integral. Crédito presumido estimado: 0.5% a 2%.
- Lucro Presumido / Real: Gera crédito integral de CBS (~8.8%) e IBS (~17.7%) a partir de 2027.
- Setor saúde: redução de 60% nas alíquotas.
- Setor educação: redução de 60%.
- Agronegócio (produtos in natura): redução de 60%.
- Construção civil / Transporte: redução de 30%.
- Imposto Seletivo: cigarros, bebidas alcoólicas, refrigerantes, veículos.
- Retorne apenas JSON, sem markdown, sem explicação fora do JSON.`

export async function enriquecerCnpj(cnpj: string, fornecedorId: string): Promise<void> {
  const cnpjLimpo = cnpj.replace(/\D/g, '')

  try {
    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: `Consulte e classifique o CNPJ: ${cnpjLimpo}`,
      },
    ]

    // Agentic loop com tool use
    let resposta = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT_ENRIQUECEDOR,
      tools: [ferramentaBrasilApi, ferramentaReceitaWS],
      messages,
    })

    // Loop até parar de usar ferramentas
    while (resposta.stop_reason === 'tool_use') {
      const toolUseBlock = resposta.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )
      if (!toolUseBlock) break

      let toolResult: object
      try {
        toolResult = await executarFerramenta(
          toolUseBlock.name,
          toolUseBlock.input as { cnpj: string }
        )
      } catch (e) {
        toolResult = { erro: String(e) }
      }

      messages.push(
        { role: 'assistant', content: resposta.content },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUseBlock.id,
              content: JSON.stringify(toolResult),
            },
          ],
        }
      )

      resposta = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SYSTEM_PROMPT_ENRIQUECEDOR,
        tools: [ferramentaBrasilApi, ferramentaReceitaWS],
        messages,
      })
    }

    // Extrair texto da resposta final
    const textoFinal = resposta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const dados = JSON.parse(textoFinal)

    // Atualizar fornecedor no banco
    await db
      .update(fornecedores)
      .set({
        razaoSocial: dados.razao_social,
        nomeFantasia: dados.nome_fantasia,
        regime: dados.regime,
        setor: dados.setor,
        cnaeCodigoPrincipal: dados.cnae_codigo,
        cnaeDescricaoPrincipal: dados.cnae_descricao,
        uf: dados.uf,
        municipio: dados.municipio,
        porte: dados.porte,
        situacaoCadastral: dados.situacao_cadastral,
        geraCredito: dados.gera_credito,
        percentualCreditoEstimado: String(dados.percentual_credito_estimado),
        sujetoImpSeletivo: dados.sujeto_imposto_seletivo,
        setorDiferenciadoReforma: dados.setor_diferenciado_reforma,
        reducaoAliquota: String(dados.reducao_aliquota_percentual),
        statusEnriquecimento: 'concluido',
        ultimoEnriquecimentoEm: new Date(),
      })
      .where(eq(fornecedores.id, fornecedorId))
  } catch (error) {
    await db
      .update(fornecedores)
      .set({
        statusEnriquecimento: 'erro',
        erroEnriquecimento: String(error),
        ultimoEnriquecimentoEm: new Date(),
      })
      .where(eq(fornecedores.id, fornecedorId))

    throw error
  }
}
