import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { empresas, fornecedores, novidades } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { formatarMoeda, labelRegime, labelSetor } from '@/lib/utils'
import { calcularImpacto } from '@/lib/simulador/motor-calculo'
import Link from 'next/link'

export default async function DashboardPage() {
  const { userId, orgId } = await auth()

  if (!userId || !orgId) {
    redirect('/sign-in')
  }

  const empresa = await db.query.empresas.findFirst({
    where: eq(empresas.organizationId, orgId),
  })

  if (!empresa) {
    redirect('/onboarding')
  }

  // Dados de fornecedores
  const [totalFornecedores] = await db
    .select({ total: count() })
    .from(fornecedores)
    .where(and(eq(fornecedores.empresaId, empresa.id), eq(fornecedores.ativo, true)))

  const [fornecedoresEnriquecidos] = await db
    .select({ total: count() })
    .from(fornecedores)
    .where(
      and(
        eq(fornecedores.empresaId, empresa.id),
        eq(fornecedores.statusEnriquecimento, 'concluido')
      )
    )

  // Últimas novidades
  const ultimasNovidades = await db.query.novidades.findMany({
    where: eq(novidades.ativo, true),
    orderBy: [desc(novidades.dataPublicacao)],
    limit: 5,
  })

  // Simulação rápida para 2027 (primeiro ano de impacto real)
  let simulacao2027 = null
  if (empresa.faturamentoAnual && empresa.aliquotaIcmsAtual && empresa.aliquotaIssAtual) {
    try {
      simulacao2027 = calcularImpacto({
        ano: 2027,
        regime: empresa.regime,
        setor: empresa.setor,
        faturamentoAnual: parseFloat(empresa.faturamentoAnual),
        aliquotaIcms: parseFloat(empresa.aliquotaIcmsAtual),
        aliquotaIss: parseFloat(empresa.aliquotaIssAtual),
      })
    } catch {
      // Silenciosamente ignorar erro de simulação no dashboard
    }
  }

  const percentualEnriquecidos =
    totalFornecedores.total > 0
      ? Math.round((fornecedoresEnriquecidos.total / totalFornecedores.total) * 100)
      : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Visão geral do impacto da Reforma Tributária na sua empresa
        </p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Regime</p>
          <p className="text-xl font-bold text-slate-900">{labelRegime(empresa.regime)}</p>
          <p className="text-sm text-slate-500 mt-1">{labelSetor(empresa.setor)}</p>
        </div>

        {simulacao2027 && (
          <>
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Carga atual (2026)
              </p>
              <p className="text-xl font-bold text-slate-900">
                {formatarMoeda(simulacao2027.cargaAtual)}
              </p>
              <p className="text-sm text-slate-500 mt-1">PIS/COFINS + ICMS + ISS</p>
            </div>

            <div className={`bg-white rounded-xl border p-5 ${
              simulacao2027.variacaoPercentual > 0 ? 'border-red-200' : 'border-green-200'
            }`}>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Carga futura (2027)
              </p>
              <p className="text-xl font-bold text-slate-900">
                {formatarMoeda(simulacao2027.cargaFutura)}
              </p>
              <p className={`text-sm mt-1 font-medium ${
                simulacao2027.variacaoPercentual > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {simulacao2027.variacaoPercentual > 0 ? '+' : ''}
                {simulacao2027.variacaoPercentual.toFixed(1)}%
              </p>
            </div>
          </>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Fornecedores
          </p>
          <p className="text-xl font-bold text-slate-900">{totalFornecedores.total}</p>
          <p className="text-sm text-slate-500 mt-1">
            {percentualEnriquecidos}% enriquecidos
          </p>
        </div>
      </div>

      {/* Links rápidos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/simulador"
          className="bg-blue-600 text-white rounded-xl p-5 hover:bg-blue-700 transition-colors"
        >
          <p className="font-semibold">Acessar Simulador</p>
          <p className="text-sm text-blue-200 mt-1">Calcule o impacto para 2026–2033</p>
        </Link>
        <Link
          href="/fornecedores/importar"
          className="bg-white border border-slate-200 rounded-xl p-5 hover:bg-slate-50 transition-colors"
        >
          <p className="font-semibold text-slate-900">Importar Fornecedores</p>
          <p className="text-sm text-slate-500 mt-1">Upload CSV/XLSX com até 15.000 CNPJs</p>
        </Link>
        <Link
          href="/agente"
          className="bg-white border border-slate-200 rounded-xl p-5 hover:bg-slate-50 transition-colors"
        >
          <p className="font-semibold text-slate-900">Falar com o Agente</p>
          <p className="text-sm text-slate-500 mt-1">Tire dúvidas sobre a reforma</p>
        </Link>
      </div>

      {/* Últimas novidades */}
      {ultimasNovidades.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Últimas Novidades</h2>
            <Link href="/novidades" className="text-sm text-blue-600 hover:underline">
              Ver todas
            </Link>
          </div>
          <div className="space-y-3">
            {ultimasNovidades.map((novidade) => (
              <div key={novidade.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                <span className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                  novidade.nivelImpacto === 'alto'
                    ? 'bg-red-100 text-red-700'
                    : novidade.nivelImpacto === 'medio'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {novidade.nivelImpacto ?? 'baixo'}
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{novidade.titulo}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{novidade.resumo.slice(0, 120)}...</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
