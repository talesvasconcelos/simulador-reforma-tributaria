import { NextRequest, NextResponse } from 'next/server'
import { atualizarNovidades } from '@/lib/ai/agente-novidades'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function verificarSecret(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  return !!(cronSecret && cronSecret.length >= 16 && authHeader === `Bearer ${cronSecret}`)
}

async function executar() {
  const resultado = await atualizarNovidades()
  return NextResponse.json({
    sucesso: true,
    novas: resultado.novas,
    erros: resultado.erros,
    executadoEm: new Date().toISOString(),
  })
}

// Vercel Cron Jobs enviam GET — este é o handler principal do cron
export async function GET(req: NextRequest) {
  if (!verificarSecret(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  try {
    return await executar()
  } catch (error) {
    console.error('[Cron] Erro ao atualizar novidades:', error)
    return NextResponse.json({ error: 'Erro interno ao atualizar novidades' }, { status: 500 })
  }
}

// POST mantido para disparo manual via ferramentas/testes
export async function POST(req: NextRequest) {
  if (!verificarSecret(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  try {
    return await executar()
  } catch (error) {
    console.error('[Cron] Erro ao atualizar novidades:', error)
    return NextResponse.json({ error: 'Erro interno ao atualizar novidades' }, { status: 500 })
  }
}
