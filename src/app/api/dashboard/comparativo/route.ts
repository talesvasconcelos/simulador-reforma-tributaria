import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, faturamentoMensal, fornecedores } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { analisarFaturamento } from '@/lib/simulador/analise-clientes'
import { calcularCustoEfetivo } from '@/lib/simulador/analise-fornecedores'

export const dynamic = 'force-dynamic'

const ANOS_PROJECAO = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

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
  const anoRef = parseInt(searchParams.get('ano') ?? '2025')

  // Buscar faturamento do ano de referência
  const fatRegistros = await db.query.faturamentoMensal.findMany({
    where: and(
      eq(faturamentoMensal.empresaId, empresa.id),
      eq(faturamentoMensal.anoReferencia, anoRef)
    ),
  })

  const temDados = fatRegistros.length > 0

  // Calcular faturamento médio mensal
  let mediaMensal: number
  let pctB2B: number
  let pctPublico: number
  let pctB2C: number
  let mesesComDados = 0

  if (temDados) {
    const totalAnual = fatRegistros.reduce((acc, r) => acc + parseFloat(r.valorTotal), 0)
    mesesComDados = fatRegistros.length
    mediaMensal = totalAnual / mesesComDados

    const temBreakdown = fatRegistros.some((r) => r.valorB2B !== null || r.valorPublico !== null)

    if (temBreakdown && totalAnual > 0) {
      const totalB2B = fatRegistros.reduce((acc, r) => acc + (r.valorB2B ? parseFloat(r.valorB2B) : 0), 0)
      const totalPub = fatRegistros.reduce((acc, r) => acc + (r.valorPublico ? parseFloat(r.valorPublico) : 0), 0)
      pctB2B = Math.round((totalB2B / totalAnual) * 100)
      pctPublico = Math.round((totalPub / totalAnual) * 100)
      pctB2C = Math.max(0, 100 - pctB2B - pctPublico)
    } else {
      pctB2B = 60
      pctPublico = 20
      pctB2C = 20
    }
  } else {
    // Fallback: usar faturamentoAnual cadastrado
    const fatAnual = empresa.faturamentoAnual ? parseFloat(empresa.faturamentoAnual) : 0
    mediaMensal = fatAnual / 12
    pctB2B = 60
    pctPublico = 20
    pctB2C = 20
  }

  // Buscar fornecedores ativos com valor
  const listaFornecedores = await db.query.fornecedores.findMany({
    where: and(
      eq(fornecedores.empresaId, empresa.id),
      eq(fornecedores.ativo, true)
    ),
  })

  const fornecedoresComValor = listaFornecedores.filter(
    (f) => f.precoReferencia !== null || f.valorMedioComprasMensal !== null
  )

  const gastosMensais = fornecedoresComValor.reduce((acc, f) => {
    const val = f.precoReferencia
      ? parseFloat(f.precoReferencia)
      : f.valorMedioComprasMensal
      ? parseFloat(f.valorMedioComprasMensal)
      : 0
    return acc + val
  }, 0)

  // Créditos potenciais em 2027
  const creditosMensais2027 = fornecedoresComValor.reduce((acc, f) => {
    if (!f.regime || !f.setor) return acc
    const val = f.precoReferencia
      ? parseFloat(f.precoReferencia)
      : f.valorMedioComprasMensal
      ? parseFloat(f.valorMedioComprasMensal)
      : 0
    if (val <= 0) return acc

    const analise = calcularCustoEfetivo({
      fornecedorId: f.id,
      cnpj: f.cnpj,
      nome: f.razaoSocial ?? f.nomeErp ?? f.cnpj,
      regime: f.regime,
      setor: f.setor,
      precoMedioMensal: val,
      setorComprador: empresa.setor,
      regimeComprador: empresa.regime,
      ano: 2027,
      opcaoCbsIbsPorFora: f.opcaoCbsIbsPorFora ?? false,
    })
    return acc + analise.creditoMensal
  }, 0)

  const percentualCreditoSobreGastos =
    gastosMensais > 0 ? (creditosMensais2027 / gastosMensais) * 100 : 0

  // Cálculo da carga tributária no sistema atual (2025 baseline)
  const aliquotaIcmsPct = empresa.aliquotaIcmsAtual ? parseFloat(empresa.aliquotaIcmsAtual) : 0
  const aliquotaIssPct = empresa.aliquotaIssAtual ? parseFloat(empresa.aliquotaIssAtual) : 0

  let pisCofins2025 = 0
  if (empresa.regime === 'lucro_real' || empresa.regime === 'lucro_presumido') {
    pisCofins2025 = mediaMensal * 0.0925
  } else if (empresa.regime === 'simples_nacional') {
    pisCofins2025 = mediaMensal * 0.03
  }
  const icms2025 = mediaMensal * (aliquotaIcmsPct / 100)
  const iss2025 = mediaMensal * (aliquotaIssPct / 100)
  const cargaAtualMensal = pisCofins2025 + icms2025 + iss2025

  // Projetos para cada ano
  const projecao = ANOS_PROJECAO.map((ano) => {
    const faturamentoAnual = mediaMensal * 12
    const gastosMensaisAnual = gastosMensais * 12

    if (ano === 2025) {
      const tributosAnual = cargaAtualMensal * 12
      return {
        ano,
        faturamentoAnual,
        gastosMensaisAnual,
        cbsIbsBrutoAnual: 0,
        icmsIssRestanteAnual: tributosAnual,
        creditosAnual: 0,
        cargaTributariaLiquidaAnual: tributosAnual,
        resultadoLiquidoAnual: faturamentoAnual - gastosMensaisAnual - tributosAnual,
        variacaoVs2025: 0,
        isReferencia: true,
      }
    }

    // Para 2026-2033: usar analisarFaturamento
    const creditosMensaisAno = fornecedoresComValor.reduce((acc, f) => {
      if (!f.regime || !f.setor) return acc
      const val = f.precoReferencia
        ? parseFloat(f.precoReferencia)
        : f.valorMedioComprasMensal
        ? parseFloat(f.valorMedioComprasMensal)
        : 0
      if (val <= 0) return acc
      const analise = calcularCustoEfetivo({
        fornecedorId: f.id,
        cnpj: f.cnpj,
        nome: f.razaoSocial ?? f.nomeErp ?? f.cnpj,
        regime: f.regime,
        setor: f.setor,
        precoMedioMensal: val,
        setorComprador: empresa.setor,
        regimeComprador: empresa.regime,
        ano,
        opcaoCbsIbsPorFora: f.opcaoCbsIbsPorFora ?? false,
      })
      return acc + analise.creditoMensal
    }, 0)

    const resultado = analisarFaturamento({
      faturamentoMensal: mediaMensal,
      setor: empresa.setor,
      regime: empresa.regime,
      perfilClientes: {
        percentualB2BPrivado: pctB2B,
        percentualPublico: pctPublico,
        percentualB2C: pctB2C,
      },
      creditosMensaisFornecedores: creditosMensaisAno,
      ano,
      aliquotaIcms: aliquotaIcmsPct,
      aliquotaIss: aliquotaIssPct,
    })

    const cbsIbsBrutoAnual = resultado.totalImpostoNasVendas * 12
    const icmsIssRestanteAnual = resultado.icmsIssRestanteMensal * 12
    const creditosAnual = creditosMensaisAno * 12
    const cargaTributariaLiquidaAnual = resultado.saldoLiquidoMensal * 12
    const resultadoLiquidoAnual = faturamentoAnual - gastosMensaisAnual - cargaTributariaLiquidaAnual
    const cargaBaseline = cargaAtualMensal * 12
    const variacaoVs2025 = cargaBaseline > 0
      ? ((cargaTributariaLiquidaAnual - cargaBaseline) / cargaBaseline) * 100
      : 0

    return {
      ano,
      faturamentoAnual,
      gastosMensaisAnual,
      cbsIbsBrutoAnual,
      icmsIssRestanteAnual,
      creditosAnual,
      cargaTributariaLiquidaAnual,
      resultadoLiquidoAnual,
      variacaoVs2025,
      isReferencia: false,
    }
  })

  return NextResponse.json({
    anoReferencia: anoRef,
    faturamento: {
      mediaMensal,
      totalAnual: mediaMensal * 12,
      pctB2B,
      pctPublico,
      pctB2C,
      mesesComDados,
      temDados,
    },
    gastos: {
      totalMensal: gastosMensais,
      totalAnual: gastosMensais * 12,
      fornecedoresComValor: fornecedoresComValor.length,
      totalFornecedores: listaFornecedores.length,
      creditosMensaisPotenciais2027: creditosMensais2027,
      percentualCreditoSobreGastos,
    },
    projecao,
    empresa: {
      razaoSocial: empresa.razaoSocial,
      regime: empresa.regime,
      setor: empresa.setor,
      uf: empresa.uf,
    },
  })
}
