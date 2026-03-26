import { db } from '@/lib/db'
import { novidades } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'

const badgeImpacto = {
  alto: 'bg-red-100 text-red-700 border-red-200',
  medio: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  baixo: 'bg-green-100 text-green-700 border-green-200',
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Novidades</h1>
          <p className="text-slate-500 text-sm mt-1">
            Atualizações diárias da Reforma Tributária — DOU, Receita Federal e CGIBS
          </p>
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">
            Nenhuma novidade ainda. O feed é atualizado automaticamente todos os dias às 8h.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((novidade) => (
            <div
              key={novidade.id}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${
                      badgeImpacto[(novidade.nivelImpacto ?? 'baixo') as keyof typeof badgeImpacto]
                    }`}>
                      {novidade.nivelImpacto ?? 'baixo'} impacto
                    </span>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {labelTipo[novidade.tipo as keyof typeof labelTipo] ?? novidade.tipo}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(novidade.dataPublicacao), "d 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}
                    </span>
                    <span className="text-xs text-slate-400">— {novidade.fonte}</span>
                  </div>

                  <h3 className="font-semibold text-slate-900 mb-1">{novidade.titulo}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{novidade.resumo}</p>

                  {(novidade.impactaSetores as string[] | null)?.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {(novidade.impactaSetores as string[]).map((setor) => (
                        <span
                          key={setor}
                          className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded"
                        >
                          {setor}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {novidade.urlOriginal && (
                    <a
                      href={novidade.urlOriginal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Ver fonte
                    </a>
                  )}
                  <Link
                    href={`/agente?contexto=${encodeURIComponent(novidade.titulo)}`}
                    className="text-xs text-slate-500 hover:text-blue-600 hover:underline"
                  >
                    Perguntar ao agente
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
