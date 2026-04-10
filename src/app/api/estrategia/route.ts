import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { calcularCustoEfetivo, projetarEconomiaAnual } from '@/lib/simulador/analise-fornecedores'
import { labelSetor } from '@/lib/utils'

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

  // Buscar fornecedores com dados de enriquecimento
  const lista = await db.query.fornecedores.findMany({
    where: and(
      eq(fornecedores.empresaId, empresa.id),
      eq(fornecedores.ativo, true),
    ),
  })

  // precoReferencia (manual) tem prioridade sobre valorMedioComprasMensal (importação/CSV)
  const listaComPreco = lista
    .filter((f) => f.regime && f.setor && (f.precoReferencia ?? f.valorMedioComprasMensal))
    .map((f) => ({
      ...f,
      precoFinal: parseFloat(f.precoReferencia ?? f.valorMedioComprasMensal!),
    }))

  // Calcular custo efetivo para cada fornecedor
  const analises = listaComPreco
    .map((f) =>
      calcularCustoEfetivo({
        fornecedorId: f.id,
        cnpj: f.cnpj,
        nome: f.razaoSocial ?? f.nomeErp ?? f.cnpj,
        regime: f.regime!,
        setor: f.setor!,
        precoMedioMensal: f.precoFinal,
        setorComprador: empresa.setor,
        regimeComprador: empresa.regime,
        ano,
        opcaoCbsIbsPorFora: f.opcaoCbsIbsPorFora ?? false,
      })
    )
    .sort((a, b) => a.custoEfetivo - b.custoEfetivo) // Ranking por custo efetivo

  // Projeção da economia anual (2026–2033)
  const paramsProjecao = listaComPreco.map((f) => ({
    fornecedorId: f.id,
    cnpj: f.cnpj,
    nome: f.razaoSocial ?? f.nomeErp ?? f.cnpj,
    regime: f.regime!,
    setor: f.setor!,
    precoMedioMensal: f.precoFinal,
    setorComprador: empresa.setor,
    regimeComprador: empresa.regime,
    ano,
    opcaoCbsIbsPorFora: f.opcaoCbsIbsPorFora ?? false,
  }))

  const economiaAnual = projetarEconomiaAnual(paramsProjecao)

  const totalCreditoEstimadoMensal = analises.reduce((sum, a) => sum + a.creditoMensal, 0)
  const totalComprasMensais = analises.reduce((sum, a) => sum + a.precoMedioMensal, 0)
  const fornecedoresComRisco = analises.filter((a) => a.recomendacao === 'avaliar_substituto')
  const fornecedoresParaRenegociar = analises.filter((a) => a.recomendacao === 'renegociar')
  // Total de fornecedores cadastrados (incluindo sem preço)
  const totalCadastrados = lista.filter((f) => f.ativo).length

  // Crédito perdido: comprador que não pode apropriar crédito (Simples/MEI)
  const podeApropriarCredito =
    empresa.regime === 'lucro_real' || empresa.regime === 'lucro_presumido'
  const totalCreditoPerdidoMensal = podeApropriarCredito
    ? 0
    : analises.reduce((sum, a) => sum + a.creditoPotencialMensal, 0)

  // Dashboard de crédito perdido por setor do fornecedor
  // Agrupa todos os fornecedores com preço por setor e calcula % de crédito médio
  const porSetor = analises.reduce<Record<string, {
    setor: string
    label: string
    qtdFornecedores: number
    totalComprasMensal: number
    totalCreditoMensal: number
    percentualCreditoMedio: number
  }>>((acc, a) => {
    const key = a.setor
    if (!acc[key]) {
      acc[key] = {
        setor: key,
        label: labelSetor(key),
        qtdFornecedores: 0,
        totalComprasMensal: 0,
        totalCreditoMensal: 0,
        percentualCreditoMedio: 0,
      }
    }
    acc[key].qtdFornecedores++
    acc[key].totalComprasMensal += a.precoMedioMensal
    acc[key].totalCreditoMensal += a.creditoMensal
    return acc
  }, {})

  const analisesPorSetor = Object.values(porSetor)
    .map((s) => ({
      ...s,
      percentualCreditoMedio: s.totalComprasMensal > 0
        ? (s.totalCreditoMensal / s.totalComprasMensal) * 100
        : 0,
      totalComprasAnual: s.totalComprasMensal * 12,
      totalCreditoAnual: s.totalCreditoMensal * 12,
      creditoPerdidoAnual: podeApropriarCredito
        ? 0
        : s.totalCreditoMensal * 12,  // para Simples/MEI, todo crédito potencial é perdido
    }))
    .sort((a, b) => a.percentualCreditoMedio - b.percentualCreditoMedio) // menor crédito primeiro

  return NextResponse.json({
    analises,
    resumo: {
      totalFornecedores: analises.length,
      totalCadastrados,
      totalCreditoEstimadoMensal,
      totalCreditoEstimadoAnual: totalCreditoEstimadoMensal * 12,
      totalComprasMensais,
      totalComprasAnuais: totalComprasMensais * 12,
      fornecedoresComRisco: fornecedoresComRisco.length,
      fornecedoresParaRenegociar: fornecedoresParaRenegociar.length,
      totalCreditoPerdidoMensal,
      totalCreditoPerdidoAnual: totalCreditoPerdidoMensal * 12,
      podeApropriarCredito,
    },
    economiaAnual,
    analisesPorSetor,
    ano,
  })
}
