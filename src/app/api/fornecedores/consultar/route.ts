import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { consultarCnpjBrasilApi } from '@/lib/cnpj/brasil-api'
import { consultarCnpjReceitaWS } from '@/lib/cnpj/receita-ws'

export const dynamic = 'force-dynamic'

// Formato normalizado retornado para o cliente
export interface DadosCnpjNormalizado {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  cnae_fiscal_descricao: string
  uf: string
  municipio: string
  porte: string
  opcao_pelo_simples: boolean
  opcao_pelo_mei: boolean
  situacao_cadastral: number
  descricao_situacao_cadastral: string
  fonte: 'brasilapi' | 'receitaws'
}

export async function GET(req: NextRequest) {
  let userId: string | null = null
  try {
    const authResult = await auth()
    userId = authResult.userId
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!userId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const cnpj = req.nextUrl.searchParams.get('cnpj')?.replace(/\D/g, '')
  if (!cnpj || cnpj.length !== 14) {
    return NextResponse.json({ error: 'CNPJ inválido — informe 14 dígitos' }, { status: 400 })
  }

  // Tenta BrasilAPI primeiro
  try {
    const dados = await consultarCnpjBrasilApi(cnpj)
    const normalizado: DadosCnpjNormalizado = {
      cnpj: dados.cnpj,
      razao_social: dados.razao_social,
      nome_fantasia: dados.nome_fantasia || undefined,
      cnae_fiscal_descricao: dados.cnae_fiscal_descricao,
      uf: dados.uf,
      municipio: dados.municipio,
      porte: dados.porte,
      opcao_pelo_simples: dados.opcao_pelo_simples,
      opcao_pelo_mei: dados.opcao_pelo_mei,
      situacao_cadastral: dados.situacao_cadastral,
      descricao_situacao_cadastral: dados.descricao_situacao_cadastral,
      fonte: 'brasilapi',
    }
    return NextResponse.json(normalizado)
  } catch {
    // BrasilAPI falhou — tenta ReceitaWS sem delay de rate limit
  }

  // Fallback: ReceitaWS
  try {
    const dados = await consultarCnpjReceitaWS(cnpj, false)
    const normalizado: DadosCnpjNormalizado = {
      cnpj: dados.cnpj,
      razao_social: dados.nome,
      nome_fantasia: dados.fantasia || undefined,
      cnae_fiscal_descricao: dados.atividade_principal[0]?.text ?? '',
      uf: dados.uf,
      municipio: dados.municipio,
      porte: dados.porte,
      opcao_pelo_simples: dados.simples?.optante ?? false,
      opcao_pelo_mei: dados.simei?.optante ?? dados.mei?.optante ?? false,
      situacao_cadastral: dados.situacao === 'ATIVA' ? 2 : 0,
      descricao_situacao_cadastral: dados.situacao,
      fonte: 'receitaws',
    }
    return NextResponse.json(normalizado)
  } catch (err: unknown) {
    console.error('[fornecedores/consultar] Erro ao consultar CNPJ:', err)
    const isNotFound = err instanceof Error && (err.message.includes('não encontrado') || err.message.includes('ERROR'))
    const status = isNotFound ? 404 : 502
    const msg = isNotFound ? 'CNPJ não encontrado nas fontes consultadas.' : 'Erro ao consultar CNPJ. Tente novamente.'
    return NextResponse.json({ error: msg }, { status })
  }
}
