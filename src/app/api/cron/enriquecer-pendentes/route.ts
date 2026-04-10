import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { empresas, fornecedores } from '@/lib/db/schema'
import { eq, and, or, lt, isNull } from 'drizzle-orm'
import { enriquecerCnpjPorRegras } from '@/lib/ai/enriquecimento-regras'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** CNPJs processados por empresa por execução do cron */
const POR_RODADA = 5

/** Intervalo entre chamadas às APIs externas (ms) — respeita rate limit BrasilAPI */
const DELAY_MS = 4500

export async function GET(req: NextRequest) {
  // Vercel Cron Jobs enviam o header Authorization com o CRON_SECRET configurado no projeto
  const authorization = req.headers.get('authorization')
  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // Resetar registros presos em 'em_processamento' há mais de 5 min (função que travou)
  const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000)
  await db
    .update(fornecedores)
    .set({ statusEnriquecimento: 'pendente' })
    .where(
      and(
        eq(fornecedores.statusEnriquecimento, 'em_processamento'),
        lt(fornecedores.ultimoEnriquecimentoEm, cincoMinutosAtras)
      )
    )

  // Buscamos todas as empresas para processar cada uma
  const todasEmpresas = await db.query.empresas.findMany({
    columns: { id: true },
  })

  const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000)

  let totalProcessados = 0
  let totalErros = 0

  for (const empresa of todasEmpresas) {
    // Pegar CNPJs pendentes OU nao_encontrado (com retry após 1h)
    const candidatos = await db.query.fornecedores.findMany({
      where: and(
        eq(fornecedores.empresaId, empresa.id),
        or(
          eq(fornecedores.statusEnriquecimento, 'pendente'),
          and(
            eq(fornecedores.statusEnriquecimento, 'nao_encontrado'),
            or(
              isNull(fornecedores.ultimoEnriquecimentoEm),
              lt(fornecedores.ultimoEnriquecimentoEm, umaHoraAtras)
            )
          )
        )
      ),
      limit: POR_RODADA,
      orderBy: (t, { asc }) => [asc(t.criadoEm)],
      columns: { id: true, cnpj: true },
    })

    if (candidatos.length === 0) continue

    // Marcar como em_processamento para evitar duplicatas entre execuções concorrentes
    for (const f of candidatos) {
      await db
        .update(fornecedores)
        .set({ statusEnriquecimento: 'em_processamento', ultimoEnriquecimentoEm: new Date() })
        .where(
          and(
            eq(fornecedores.id, f.id),
            // Garantia extra: só marca se ainda estiver pendente/nao_encontrado
            or(
              eq(fornecedores.statusEnriquecimento, 'pendente'),
              eq(fornecedores.statusEnriquecimento, 'nao_encontrado')
            )
          )
        )
    }

    // Processar cada CNPJ com delay entre eles
    for (let i = 0; i < candidatos.length; i++) {
      const f = candidatos[i]
      try {
        await enriquecerCnpjPorRegras(f.cnpj, f.id)
        totalProcessados++
      } catch {
        totalErros++
        // enriquecerCnpjPorRegras já atualiza o status para 'erro' internamente
      }

      if (i < candidatos.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_MS))
      }
    }
  }

  console.log(`[cron/enriquecer-pendentes] processados=${totalProcessados} erros=${totalErros}`)
  return NextResponse.json({ processados: totalProcessados, erros: totalErros })
}
