import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { empresas, faturamentoMensal } from '@/lib/db/schema'
import { eq, asc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
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

  const registros = await db.query.faturamentoMensal.findMany({
    where: eq(faturamentoMensal.empresaId, empresa.id),
    orderBy: [asc(faturamentoMensal.competencia)],
  })

  const anos = [...new Set(registros.map((r) => r.anoReferencia))].sort()

  const porAno: Record<number, {
    totalAnual: number
    mediaMensal: number
    meses: number
    temBreakdown: boolean
    pctB2B: number | null
    pctPublico: number | null
    pctB2C: number | null
  }> = {}

  for (const ano of anos) {
    const doAno = registros.filter((r) => r.anoReferencia === ano)
    const totalAnual = doAno.reduce((acc, r) => acc + parseFloat(r.valorTotal), 0)
    const meses = doAno.length
    const mediaMensal = meses > 0 ? totalAnual / meses : 0

    const temBreakdown = doAno.some((r) => r.valorB2B !== null || r.valorPublico !== null || r.valorB2C !== null)

    let pctB2B: number | null = null
    let pctPublico: number | null = null
    let pctB2C: number | null = null

    if (temBreakdown && totalAnual > 0) {
      const totalB2B = doAno.reduce((acc, r) => acc + (r.valorB2B ? parseFloat(r.valorB2B) : 0), 0)
      const totalPublico = doAno.reduce((acc, r) => acc + (r.valorPublico ? parseFloat(r.valorPublico) : 0), 0)
      const totalB2C = doAno.reduce((acc, r) => acc + (r.valorB2C ? parseFloat(r.valorB2C) : 0), 0)
      pctB2B = (totalB2B / totalAnual) * 100
      pctPublico = (totalPublico / totalAnual) * 100
      pctB2C = (totalB2C / totalAnual) * 100
    }

    porAno[ano] = { totalAnual, mediaMensal, meses, temBreakdown, pctB2B, pctPublico, pctB2C }
  }

  return NextResponse.json({
    registros: registros.map((r) => ({
      competencia: r.competencia,
      anoReferencia: r.anoReferencia,
      valorTotal: parseFloat(r.valorTotal),
      valorB2B: r.valorB2B ? parseFloat(r.valorB2B) : null,
      valorPublico: r.valorPublico ? parseFloat(r.valorPublico) : null,
      valorB2C: r.valorB2C ? parseFloat(r.valorB2C) : null,
    })),
    anos,
    porAno,
    temDados: registros.length > 0,
  })
}
