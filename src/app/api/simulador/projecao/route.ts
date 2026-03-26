import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { z } from 'zod'
import { projetarTransicaoCompleta } from '@/lib/simulador/motor-calculo'

const schemaProjecao = z.object({
  regime: z.string(),
  setor: z.string(),
  faturamentoAnual: z.number().positive(),
  aliquotaIcms: z.number().min(0).max(100),
  aliquotaIss: z.number().min(0).max(100),
  comprasAnuais: z.number().min(0).optional(),
  isExportadora: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const { userId } = await auth()

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
