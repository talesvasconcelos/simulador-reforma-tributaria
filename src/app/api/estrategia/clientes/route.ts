import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { analisarFaturamento } from '@/lib/simulador/analise-clientes'
import { calcularCustoEfetivo } from '@/lib/simulador/analise-fornecedores'
import { CRONOGRAMA_TRANSICAO } from '@/lib/simulador/cronograma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  let userId: string | null = null
  let orgId: string | null = null
  try {
    const authResult = await auth()
    userId = authResult.userId
    orgId = authResult.orgId ?? null
  } catch {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (!userId || !orgId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })
  if (!empresa) {
    return NextResponse.json({ error: 'Empresa não cadastrada' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const ano = parseInt(searchParams.get('ano') ?? '2027')
  const pctB2B = parseFloat(searchParams.get('pctB2B') ?? '60')
  const pctPublico = parseFloat(searchParams.get('pctPublico') ?? '20')
  const pctB2C = Math.max(0, 100 - pctB2B - pctPublico)

  // Faturamento mensal da empresa (do cadastro ou via parâmetro)
  const faturamentoAnualCadastro = empresa.faturamentoAnual
    ? parseFloat(empresa.faturamentoAnual)
    : 0
  const faturamentoMensalParam = searchParams.get('faturamentoMensal')
  const faturamentoMensal = faturamentoMensalParam
    ? parseFloat(faturamentoMensalParam)
    : faturamentoAnualCadastro / 12

  if (faturamentoMensal <= 0) {
    return NextResponse.json(
      { error: 'Faturamento não informado. Cadastre o faturamento anual da empresa no onboarding.' },
      { status: 422 }
    )
  }

  // Calcular créditos mensais totais dos fornecedores enriquecidos
  const listaFornecedores = await db.query.fornecedores.findMany({
    where: and(
      eq(fornecedores.empresaId, empresa.id),
      eq(fornecedores.ativo, true),
    ),
  })

  const creditosMensaisFornecedores = listaFornecedores
    .filter((f) => f.regime && f.setor && (f.precoReferencia ?? f.valorMedioComprasMensal))
    .reduce((acc, f) => {
      const preco = parseFloat(f.precoReferencia ?? f.valorMedioComprasMensal!)
      const analise = calcularCustoEfetivo({
        fornecedorId: f.id,
        cnpj: f.cnpj,
        nome: f.razaoSocial ?? f.cnpj,
        regime: f.regime!,
        setor: f.setor!,
        precoMedioMensal: preco,
        setorComprador: empresa.setor,
        regimeComprador: empresa.regime,
        ano,
      })
      return acc + analise.creditoMensal
    }, 0)

  const aliquotaIcms = empresa.aliquotaIcmsAtual ? parseFloat(empresa.aliquotaIcmsAtual) : undefined
  const aliquotaIss  = empresa.aliquotaIssAtual  ? parseFloat(empresa.aliquotaIssAtual)  : undefined

  const paramsBase = {
    faturamentoMensal,
    setor: empresa.setor,
    regime: empresa.regime,
    perfilClientes: {
      percentualB2BPrivado: pctB2B,
      percentualPublico: pctPublico,
      percentualB2C: pctB2C,
    },
    creditosMensaisFornecedores,
    aliquotaIcms,
    aliquotaIss,
  }

  const resultado = analisarFaturamento({ ...paramsBase, ano })

  // Projeção ano a ano (2026–2033)
  const projecaoAnos = Object.keys(CRONOGRAMA_TRANSICAO).map((anoStr) => {
    const a = parseInt(anoStr)
    const proj = analisarFaturamento({ ...paramsBase, ano: a })
    return {
      ano: a,
      cbsIbsBrutoAnual: proj.totalImpostoNasVendas * 12,
      liquidoAnual: proj.saldoLiquidoMensal * 12,
      creditosAnual: proj.creditosFornecedores * 12,
      icmsIssRestanteAnual: proj.icmsIssRestanteMensal * 12,
    }
  })

  return NextResponse.json({
    resultado,
    projecaoAnos,
    empresa: {
      razaoSocial: empresa.razaoSocial,
      regime: empresa.regime,
      setor: empresa.setor,
      faturamentoMensal,
    },
    creditosMensaisFornecedores,
    ano,
  })
}
