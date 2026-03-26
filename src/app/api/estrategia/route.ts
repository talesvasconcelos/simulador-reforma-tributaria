import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { calcularCustoEfetivo, projetarEconomiaAnual } from '@/lib/simulador/analise-fornecedores'

export async function GET(req: NextRequest) {
  const { userId, orgId } = await auth()

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

  // Calcular custo efetivo para cada fornecedor
  const analises = lista
    .filter((f) => f.regime && f.setor && f.valorMedioComprasMensal)
    .map((f) =>
      calcularCustoEfetivo({
        fornecedorId: f.id,
        cnpj: f.cnpj,
        nome: f.razaoSocial ?? f.nomeErp ?? f.cnpj,
        regime: f.regime!,
        setor: f.setor!,
        precoMedioMensal: parseFloat(f.valorMedioComprasMensal!),
        setorComprador: empresa.setor,
        regimeComprador: empresa.regime,
        ano,
      })
    )
    .sort((a, b) => a.custoEfetivo - b.custoEfetivo) // Ranking por custo efetivo

  // Projeção da economia anual (2026–2033)
  const paramsProjecao = lista
    .filter((f) => f.regime && f.setor && f.valorMedioComprasMensal)
    .map((f) => ({
      fornecedorId: f.id,
      cnpj: f.cnpj,
      nome: f.razaoSocial ?? f.nomeErp ?? f.cnpj,
      regime: f.regime!,
      setor: f.setor!,
      precoMedioMensal: parseFloat(f.valorMedioComprasMensal!),
      setorComprador: empresa.setor,
      regimeComprador: empresa.regime,
      ano,
    }))

  const economiaAnual = projetarEconomiaAnual(paramsProjecao)

  const totalCreditoEstimadoMensal = analises.reduce((sum, a) => sum + a.creditoMensal, 0)
  const fornecedoresComRisco = analises.filter((a) => a.recomendacao === 'avaliar_substituto')
  const fornecedoresParaRenegociar = analises.filter((a) => a.recomendacao === 'renegociar')

  return NextResponse.json({
    analises,
    resumo: {
      totalFornecedores: analises.length,
      totalCreditoEstimadoMensal,
      totalCreditoEstimadoAnual: totalCreditoEstimadoMensal * 12,
      fornecedoresComRisco: fornecedoresComRisco.length,
      fornecedoresParaRenegociar: fornecedoresParaRenegociar.length,
    },
    economiaAnual,
    ano,
  })
}
