/**
 * Enriquecimento por regras — fallback quando o Claude API não está disponível.
 * Usa BrasilAPI + ReceitaWS + classificador CNAE para inferir regime, setor e créditos.
 */

import { db } from '@/lib/db'
import { fornecedores } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { classificarSetorPorCnae, inferirRegime } from '@/lib/cnpj/classificador'
import { ALIQUOTAS_SETORIAIS } from '@/lib/simulador/aliquotas'

/** Sinaliza rate limit das APIs externas — não deve ser salvo como nao_encontrado */
class RateLimitError extends Error {
  constructor(fonte: string) {
    super(`rate_limit:${fonte}`)
    this.name = 'RateLimitError'
  }
}

interface DadosCnpjBruto {
  razaoSocial: string
  nomeFantasia: string | null
  cnae: string
  cnaeDescricao: string
  uf: string
  municipio: string
  porte: string
  situacao: string
  opcaoSimples: boolean
  opcaoMei: boolean
  capitalSocial: number
  naturezaJuridica: string
}

async function buscarDadosCnpj(cnpj: string): Promise<DadosCnpjBruto | null> {
  // Tenta BrasilAPI (2 tentativas; na 2ª aguarda 3s antes de tentar)
  for (let i = 0; i < 2; i++) {
    try {
      if (i > 0) await new Promise((r) => setTimeout(r, 3000))
      const res = await fetch(`${process.env.BRASIL_API_URL ?? 'https://brasilapi.com.br/api/cnpj/v1'}/${cnpj}`, {
        signal: AbortSignal.timeout(10000),
        cache: 'no-store',
      })
      // 404 = CNPJ não existe na Receita Federal
      if (res.status === 404) return null
      // 429 = rate limit → lança erro especial para manter status como pendente
      if (res.status === 429) throw new RateLimitError('brasilapi')
      if (res.ok) {
        const d = await res.json()
        return {
          razaoSocial: d.razao_social as string,
          nomeFantasia: (d.nome_fantasia as string) || null,
          cnae: String(d.cnae_fiscal),
          cnaeDescricao: d.cnae_fiscal_descricao as string,
          uf: d.uf as string,
          municipio: d.municipio as string,
          porte: d.porte as string,
          situacao: d.descricao_situacao_cadastral as string,
          opcaoSimples: d.opcao_pelo_simples as boolean,
          opcaoMei: d.opcao_pelo_mei as boolean,
          capitalSocial: d.capital_social as number,
          naturezaJuridica: d.descricao_natureza_juridica as string,
        }
      }
    } catch (err) {
      if (err instanceof RateLimitError) throw err // propaga — não tenta ReceitaWS em rate limit
      /* erro de rede → próxima tentativa */
    }
  }

  // Fallback: ReceitaWS — uma tentativa, sem retry (evita estourar timeout da Vercel)
  try {
    const res = await fetch(`${process.env.RECEITA_WS_URL ?? 'https://www.receitaws.com.br/v1/cnpj'}/${cnpj}`, {
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    })
    // 429 = rate limit → lança erro especial para manter status como pendente
    if (res.status === 429) throw new RateLimitError('receitaws')
    if (res.status === 404) return null
    if (!res.ok) return null
    const d = await res.json()
    if (d.status === 'ERROR') return null

    return {
      razaoSocial: d.nome as string,
      nomeFantasia: (d.fantasia as string) || null,
      cnae: d.atividade_principal?.[0]?.code?.replace(/[^0-9]/g, '') ?? '0',
      cnaeDescricao: d.atividade_principal?.[0]?.text ?? '',
      uf: d.uf as string,
      municipio: d.municipio as string,
      porte: d.porte as string,
      situacao: d.situacao as string,
      opcaoSimples: d.simples?.optante ?? false,
      opcaoMei: d.simei?.optante ?? d.mei?.optante ?? false,  // ReceitaWS usa 'simei', não 'mei'
      capitalSocial: 0,
      naturezaJuridica: d.natureza_juridica as string,
    }
  } catch (err) {
    if (err instanceof RateLimitError) throw err
    return null
  }
}

function calcularCredito(regime: string, setor: string): number {
  const aliquota = ALIQUOTAS_SETORIAIS[setor]
  const reducao = aliquota?.reducaoPercentual ?? 0

  // Referência CBS: 8.8% vigente a partir de 2027 (IBS inicia gradualmente só em 2029)
  // O crédito CBS é o que o comprador Lucro Real/Presumido efetivamente obtém no curto prazo.
  // O crédito total CBS+IBS (26.5%) só se materializa em 2033 — exibido por ano na tela Estratégia.
  const creditoCbs = 8.8 * (1 - reducao / 100)

  if (regime === 'lucro_real' || regime === 'lucro_presumido') {
    return creditoCbs
  }
  if (regime === 'simples_nacional') return 1.5  // crédito presumido fixo
  if (regime === 'mei') return 0.5               // crédito presumido fixo MEI
  return 0
}

export async function enriquecerCnpjPorRegras(cnpj: string, fornecedorId: string): Promise<void> {
  const cnpjLimpo = cnpj.replace(/\D/g, '')

  try {
    const dados = await buscarDadosCnpj(cnpjLimpo)

    // Ambas as APIs falharam (CNPJ não existe na Receita Federal)
    if (!dados) {
      await db
        .update(fornecedores)
        .set({
          statusEnriquecimento: 'nao_encontrado',
          erroEnriquecimento: 'CNPJ não localizado na Receita Federal (BrasilAPI + ReceitaWS). Verifique se o CNPJ está ativo ou preencha os dados manualmente.',
          ultimoEnriquecimentoEm: new Date(),
        })
        .where(eq(fornecedores.id, fornecedorId))
      return
    }

    // Regime: Simples/MEI identificados pela API; demais PJ são Lucro Presumido por padrão
    // (Lucro Real é minoria — empresas faturamento > R$78M/ano ou setores obrigatórios)
    let regime = inferirRegime({
      opcaoSimples: dados.opcaoSimples,
      opcaoMei: dados.opcaoMei,
      capitalSocial: dados.capitalSocial,
      naturezaJuridica: dados.naturezaJuridica,
      porte: dados.porte,  // BrasilAPI retorna 'MEI' quando enquadrado no SIMEI
    })
    if (regime === 'nao_identificado') {
      // Órgãos públicos e entidades sem fins lucrativos → isento
      const nat = dados.naturezaJuridica?.toLowerCase() ?? ''
      if (nat.includes('público') || nat.includes('autarquia') || nat.includes('fundação pública')) {
        regime = 'isento'
      } else {
        // LTDA, S/A, EIRELI etc. → Lucro Presumido (regime mais comum para PJ não-Simples)
        regime = 'lucro_presumido'
      }
    }

    const setor = classificarSetorPorCnae(dados.cnae)
    const aliquota = ALIQUOTAS_SETORIAIS[setor]
    const percentualCredito = calcularCredito(regime, setor)
    const geraCredito = percentualCredito > 0

    // Normalizar porte — BrasilAPI retorna: "MEI", "MICRO EMPRESA", "EMPRESA DE PEQUENO PORTE", "DEMAIS"
    // Nota: BrasilAPI às vezes retorna "MICRO EMPRESA" para empresas SIMEI (opcao_pelo_mei=true)
    // → quando regime for 'mei', forçar porte para 'MEI' para consistência
    const porteUpper = (dados.porte ?? '').toUpperCase()
    const porteNorm = regime === 'mei' ? 'MEI'
      : porteUpper.includes('MEI') ? 'MEI'
      : porteUpper.includes('MICRO') ? 'ME'
      : porteUpper.includes('PEQUENO') || porteUpper.includes('PEQUENA') ? 'EPP'
      : porteUpper.includes('MÉDIO') || porteUpper.includes('MEDIO') ? 'MEDIO'
      : porteUpper.includes('GRANDE') ? 'GRANDE'
      : porteUpper === 'DEMAIS' ? 'MEDIO'  // BrasilAPI usa "DEMAIS" para médias e grandes
      : 'NAO_INFORMADO'

    await db
      .update(fornecedores)
      .set({
        razaoSocial: dados.razaoSocial,
        nomeFantasia: dados.nomeFantasia,
        regime: regime as typeof fornecedores.$inferInsert['regime'],
        setor: setor as typeof fornecedores.$inferInsert['setor'],
        cnaeCodigoPrincipal: dados.cnae,
        cnaeDescricaoPrincipal: dados.cnaeDescricao,
        uf: dados.uf,
        municipio: dados.municipio,
        porte: porteNorm,
        situacaoCadastral: dados.situacao,
        geraCredito,
        percentualCreditoEstimado: String(percentualCredito),
        sujetoImpSeletivo: aliquota?.sujetoImpSeletivo ?? false,
        setorDiferenciadoReforma: (aliquota?.reducaoPercentual ?? 0) > 0,
        reducaoAliquota: String(aliquota?.reducaoPercentual ?? 0),
        statusEnriquecimento: 'concluido',
        ultimoEnriquecimentoEm: new Date(),
        erroEnriquecimento: null,
      })
      .where(eq(fornecedores.id, fornecedorId))
  } catch (error) {
    // Rate limit das APIs externas → mantém como pendente para o cron retentar no próximo minuto
    if (error instanceof RateLimitError) {
      await db
        .update(fornecedores)
        .set({
          statusEnriquecimento: 'pendente',
          ultimoEnriquecimentoEm: new Date(),
        })
        .where(eq(fornecedores.id, fornecedorId))
      return
    }
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
