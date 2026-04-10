export const dynamic = 'force-dynamic'

import { db } from '@/lib/db'
import { novidades } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import { ExternalLink, MessageSquare } from 'lucide-react'

const badgeImpacto = {
  alto: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medio: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  baixo: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

const labelTipo = {
  instrucao_normativa: 'Instrução Normativa',
  resolucao_comite_gestor: 'Resolução CGIBS',
  diario_oficial: 'Diário Oficial',
  portaria: 'Portaria',
  solucao_consulta: 'Solução de Consulta',
  noticia: 'Notícia',
}

export default async function NovidadesPage() {
  const lista = await db.query.novidades.findMany({
    where: eq(novidades.ativo, true),
    orderBy: [desc(novidades.dataPublicacao)],
    limit: 50,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Novidades Legislativas</h1>
        <p className="text-muted-foreground/70 text-xs mt-0.5">
          Atualizações diárias — DOU, Receita Federal e CGIBS
        </p>
      </div>

      {lista.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-14 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">
            Nenhuma novidade ainda. O feed é atualizado automaticamente todos os dias às 8h.
          </p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden divide-y divide-border/60">
          {lista.map((novidade) => (
            <div
              key={novidade.id}
              className="flex items-start gap-4 px-5 py-4 hover:bg-accent/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    badgeImpacto[(novidade.nivelImpacto ?? 'baixo') as keyof typeof badgeImpacto]
                  }`}>
                    ● {novidade.nivelImpacto === 'alto' ? 'Alto' : novidade.nivelImpacto === 'medio' ? 'Médio' : 'Baixo'} impacto
                  </span>
                  <span className="text-xs text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-full">
                    {labelTipo[novidade.tipo as keyof typeof labelTipo] ?? novidade.tipo}
                  </span>
                  <span className="text-xs text-muted-foreground/50">
                    {format(new Date(novidade.dataPublicacao), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                  {novidade.fonte && (
                    <span className="text-xs text-muted-foreground/50">— {novidade.fonte}</span>
                  )}
                </div>

                <h3 className="font-semibold text-foreground text-sm mb-1 leading-snug">{novidade.titulo}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{novidade.resumo}</p>

                {((novidade.impactaSetores as string[] | null) ?? []).length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {(novidade.impactaSetores as string[]).map((setor) => (
                      <span
                        key={setor}
                        className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full"
                      >
                        {setor}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 items-end shrink-0 pt-0.5">
                {novidade.urlOriginal && (
                  <a
                    href={novidade.urlOriginal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
                  >
                    Fonte <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <Link
                  href={`/agente?contexto=${encodeURIComponent(novidade.titulo)}`}
                  className="flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-purple-600 transition-colors"
                >
                  <MessageSquare className="w-3 h-3" />
                  Perguntar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
