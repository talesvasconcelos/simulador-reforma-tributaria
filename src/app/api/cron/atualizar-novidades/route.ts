import { NextRequest, NextResponse } from 'next/server'
import { atualizarNovidades } from '@/lib/ai/agente-novidades'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Verificar secret do cron job
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const resultado = await atualizarNovidades()

    return NextResponse.json({
      sucesso: true,
      novas: resultado.novas,
      erros: resultado.erros,
      executadoEm: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron] Erro ao atualizar novidades:', error)
    return NextResponse.json(
      { error: 'Erro ao atualizar novidades', detalhe: String(error) },
      { status: 500 }
    )
  }
}
