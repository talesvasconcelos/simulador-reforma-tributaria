import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { projetarTransicaoCompleta } from '@/lib/simulador/motor-calculo'

export const dynamic = 'force-dynamic'

const schemaProjecao = z.object({
  regime: z.string(),
  setor: z.string(),
  faturamentoAnual: z.number().positive(),
  aliquotaIcms: z.number().min(0).max(100),
  aliquotaIss: z.number().min(0).max(100),
  comprasAnuais: z.number().min(0).optional(),
  isExportadora: z.boolean().optional(),
  pisCofinsRegime: z.enum(['cumulativo', 'nao_cumulativo']).optional(),
})

export async function POST(req: NextRequest) {
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

  const body = await req.json()
  const parse = schemaProjecao.safeParse(body)

  if (!parse.success) {
    return NextResponse.json(
      { error: 'Parâmetros inválidos', detalhes: parse.error.flatten() },
      { status: 400 }
    )
  }

  const projecao = projetarTransicaoCompleta(parse.data)
  return NextResponse.json(projecao)
}
