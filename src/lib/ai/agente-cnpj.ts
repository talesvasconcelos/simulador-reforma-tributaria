import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { fornecedores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { consultarCnpjBrasilApi, type DadosCnpjBrasilApi } from '@/lib/cnpj/brasil-api'
import { consultarCnpjReceitaWS, type DadosCnpjReceitaWS } from '@/lib/cnpj/receita-ws'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// ── Erros tipados ─────────────────────────────────────────────────────────────

/**
 * CNPJ genuinamente inexistente nas APIs da Receita Federal.
 * NÃO deve ser retentado pelo BullMQ — é um resultado definitivo.
 */
class CnpjNaoEncontradoError extends Error {
  constructor(cnpj: string) {
    super(`CNPJ ${cnpj} não encontrado nas APIs da Receita Federal`)
    this.name = 'CnpjNaoEncontradoError'
  }
}

/**
 * API temporariamente indisponível (timeout, 5xx, rate limit).
 * BullMQ deve retentar conforme backoff configurado na fila.
 */
class ErroApiTransiente extends Error {
  constructor(fonte: string, detalhe: string) {
    super(`[${fonte}] ${detalhe}`)
    this.name = 'ErroApiTransiente'
  }
}

// ── Busca nas APIs de CNPJ ───────────────────────────────────────────────────

type DadosBrutos = DadosCnpjBrasilApi | DadosCnpjReceitaWS
type FonteDados = 'brasil_api' | 'receita_ws'

/**
 * Consulta o CNPJ nas APIs públicas, com fallback ReceitaWS → BrasilAPI.
 *
 * Lança CnpjNaoEncontradoError  → CNPJ não existe na RF (sem retry).
 * Lança ErroApiTransiente       → API fora do ar, BullMQ retenta.
 */
async function buscarDadosCnpj(cnpj: string): Promise<{ dados: DadosBrutos; fonte: FonteDados }> {
  // 1. BrasilAPI — sem rate limit relevante, resposta em cache 24h
  try {
    const dados = await consultarCnpjBrasilApi(cnpj)
    return { dados, fonte: 'brasil_api' }
  } catch (e) {
    const msg = String(e)

    // BrasilAPI é autoritativa: 404 = CNPJ inexistente na Receita Federal
    if (msg.includes('não encontrado') || msg.includes('404')) {
      throw new CnpjNaoEncontradoError(cnpj)
    }

    // Qualquer outro erro (timeout, 5xx) — tentar ReceitaWS antes de desistir
    console.warn(`[CNPJ ${cnpj}] BrasilAPI falhou (${msg}) — tentando ReceitaWS como fallback`)
  }

  // 2. ReceitaWS — usado apenas como fallback para falhas transientes da BrasilAPI
  try {
    // respeitarRateLimit=false: o BullMQ limiter já controla a taxa global
    const dados = await consultarCnpjReceitaWS(cnpj, false)
    return { dados, fonte: 'receita_ws' }
  } catch (e) {
    // Se a BrasilAPI estava fora do ar e a ReceitaWS também falhou,
    // lança transiente para o BullMQ retentar o job completo depois.
    throw new ErroApiTransiente('ReceitaWS', String(e))
  }
}

// ── Classificação via Claude ──────────────────────────────────────────────────

const SYSTEM_PROMPT_CLASSIFICADOR = `Você é um especialista em tributação brasileira e classificação de empresas.

Você receberá dados brutos de um CNPJ obtidos de uma API da Receita Federal.
Analise os dados e classifique a empresa conforme a Reforma Tributária (LC 214/2025).

Retorne APENAS um JSON válido com esta estrutura exata (sem markdown, sem texto fora do JSON):
{
  "razao_social": string,
  "nome_fantasia": string | null,
  "regime": "simples_nacional" | "mei" | "lucro_presumido" | "lucro_real" | "nanoempreendedor" | "isento" | "nao_identificado",
  "setor": use EXATAMENTE um dos valores abaixo conforme o CNAE principal:
    "industria"                          (CNAE 10-33: indústria em geral)
    "comercio_atacado"                   (CNAE 46: comércio atacadista)
    "comercio_varejo"                    (CNAE 47: comércio varejista)
    "servicos"                           (serviços gerais não enquadrados abaixo)
    "profissionais_liberais"             (CNAE 69-71/74/75: advogados, contadores, arquitetos, engenheiros)
    "servicos_saude"                     (CNAE 86-88: hospitais, clínicas, laboratórios)
    "servicos_educacao"                  (CNAE 85: ensino formal)
    "servicos_financeiros"               (CNAE 64-66: bancos, seguradoras, corretoras)
    "agronegocio"                        (CNAE 01-03: produtos agropecuários in natura)
    "construcao_civil"                   (CNAE 41-43 genérico)
    "construcao_edificios"               (CNAE 41: incorporação e construção de edifícios)
    "construcao_infraestrutura"          (CNAE 42: rodovias, pontes, redes)
    "construcao_servicos_especializados" (CNAE 43: instalações, acabamentos)
    "transporte"                         (transporte genérico)
    "transporte_coletivo_passageiros"    (CNAE 4921/4922: ônibus, metrô)
    "transporte_cargas"                  (CNAE 4930+: cargas, aéreo, logística)
    "imoveis"                            (CNAE 68: atividades imobiliárias)
    "combustiveis_energia"               (CNAE 19/35: combustíveis, energia elétrica)
    "tecnologia"                         (CNAE 58-63: software, TI, SaaS)
    "hotelaria"                          (CNAE 55: hotéis, pousadas)
    "telecomunicacoes"                   (CNAE 61: telefonia, internet, TV por assinatura)
    "entidades_desportivas"              (CNAE 93: clubes, academias, esportes)
    "entidades_religiosas"               (CNAE 94: igrejas, templos)
    "misto"                              (quando a atividade abrange múltiplos setores)
  "cnae_codigo": string,
  "cnae_descricao": string,
  "uf": string (sigla do estado, ex: "SP"),
  "municipio": string,
  "porte": "MEI" | "ME" | "EPP" | "MEDIO" | "GRANDE" | "NAO_INFORMADO",
  "situacao_cadastral": string (ex: "ATIVA", "BAIXADA"),
  "gera_credito": boolean,
  "percentual_credito_estimado": number (porcentagem, ex: 1.5),
  "sujeto_imposto_seletivo": boolean,
  "setor_diferenciado_reforma": boolean (true se houver redutor de alíquota),
  "reducao_aliquota_percentual": number (0, 30, 40, 60 ou 100),
  "justificativa_classificacao": string
}

Regras de classificação para a Reforma Tributária (LC 214/2025):
- Simples Nacional / MEI: NÃO gera crédito integral. gera_credito=true mas crédito presumido estimado: MEI=0.5%, Simples=1.5%.
- Lucro Presumido / Real: Gera crédito integral. gera_credito=true, percentual_credito_estimado=8.8 (CBS) ou mais com IBS.
- Nanoempreendedor / Isento: gera_credito=false, percentual=0.
- Reduções de alíquota: saúde=60%, educação=60%, agronegócio=60%, transporte coletivo=60%, entidades desportivas=60%, construção civil=30%, profissionais liberais=30%.
- Imposto Seletivo: cigarros, bebidas alcoólicas, refrigerantes, veículos novos, armas (sujeto_imposto_seletivo=true).`

const SETORES_VALIDOS = new Set([
  'industria', 'comercio_atacado', 'comercio_varejo', 'servicos', 'profissionais_liberais',
  'servicos_saude', 'servicos_educacao', 'servicos_financeiros', 'agronegocio',
  'construcao_civil', 'construcao_edificios', 'construcao_infraestrutura',
  'construcao_servicos_especializados', 'transporte', 'transporte_coletivo_passageiros',
  'transporte_cargas', 'imoveis', 'combustiveis_energia', 'tecnologia', 'misto',
  'hotelaria', 'parques_diversao', 'fii_fiagro', 'telecomunicacoes',
  'entidades_desportivas', 'entidades_religiosas',
])

const SETOR_FALLBACK: Record<string, string> = {
  construcao: 'construcao_civil',
  construção: 'construcao_civil',
  construcao_predios: 'construcao_edificios',
  transporte_aereo: 'transporte_cargas',
  transporte_rodoviario: 'transporte_cargas',
  servico: 'servicos',
  comercio: 'comercio_varejo',
}

async function classificarComClaude(
  cnpj: string,
  dadosBrutos: DadosBrutos,
  fonte: FonteDados,
) {
  const resposta = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT_CLASSIFICADOR,
    messages: [
      {
        role: 'user',
        content: `Classifique o CNPJ ${cnpj} com base nos dados abaixo obtidos da API "${fonte}":\n\n${JSON.stringify(dadosBrutos, null, 2)}`,
      },
    ],
  })

  const texto = resposta.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')

  // Extrai o JSON mesmo que venha com markdown (```json ... ```)
  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error(`Claude não retornou JSON válido para CNPJ ${cnpj}: ${texto.slice(0, 300)}`)
  }

  const dados = JSON.parse(match[0])

  if (!SETORES_VALIDOS.has(dados.setor)) {
    dados.setor = SETOR_FALLBACK[dados.setor] ?? 'misto'
  }

  return dados
}

// ── Função principal exportada ────────────────────────────────────────────────

export async function enriquecerCnpj(cnpj: string, fornecedorId: string): Promise<void> {
  const cnpjLimpo = cnpj.replace(/\D/g, '')

  try {
    // Passo 1: buscar dados diretamente nas APIs (sem tool use do Claude)
    const { dados, fonte } = await buscarDadosCnpj(cnpjLimpo)

    // Passo 2: classificar com Claude (dados já em mãos — prompt simples, sem loop de ferramentas)
    const classificado = await classificarComClaude(cnpjLimpo, dados, fonte)

    // Passo 3: persistir resultado enriquecido
    await db
      .update(fornecedores)
      .set({
        razaoSocial: classificado.razao_social,
        nomeFantasia: classificado.nome_fantasia,
        regime: classificado.regime,
        setor: classificado.setor,
        cnaeCodigoPrincipal: classificado.cnae_codigo,
        cnaeDescricaoPrincipal: classificado.cnae_descricao,
        uf: classificado.uf,
        municipio: classificado.municipio,
        porte: classificado.porte,
        situacaoCadastral: classificado.situacao_cadastral,
        geraCredito: classificado.gera_credito,
        percentualCreditoEstimado: String(classificado.percentual_credito_estimado),
        sujetoImpSeletivo: classificado.sujeto_imposto_seletivo,
        setorDiferenciadoReforma: classificado.setor_diferenciado_reforma,
        reducaoAliquota: String(classificado.reducao_aliquota_percentual),
        dadosApiCnpj: dados as unknown as Record<string, unknown>,
        statusEnriquecimento: 'concluido',
        ultimoEnriquecimentoEm: new Date(),
      })
      .where(eq(fornecedores.id, fornecedorId))

  } catch (error) {
    if (error instanceof CnpjNaoEncontradoError) {
      // Resultado DEFINITIVO: CNPJ não existe na RF.
      // Salva nao_encontrado e retorna SEM throw — BullMQ não retentar.
      await db
        .update(fornecedores)
        .set({
          statusEnriquecimento: 'nao_encontrado',
          erroEnriquecimento: error.message,
          ultimoEnriquecimentoEm: new Date(),
        })
        .where(eq(fornecedores.id, fornecedorId))
      return
    }

    // Erro transiente (API fora do ar, rate limit, falha de parse Claude).
    // Salva o motivo como 'erro' e LANÇA — BullMQ vai retentar com backoff.
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
