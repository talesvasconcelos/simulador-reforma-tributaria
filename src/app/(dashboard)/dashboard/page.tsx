export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { empresas, fornecedores, novidades } from '@/lib/db/schema'
import { eq, and, desc, count } from 'drizzle-orm'
import { labelRegime, labelSetor } from '@/lib/utils'
import { calcularImpacto } from '@/lib/simulador/motor-calculo'
import Link from 'next/link'
import {
  Building2, TrendingUp, TrendingDown, Users, ArrowRight,
  Calculator, MessageSquare, Upload, AlertTriangle,
  CheckCircle, Clock, Minus,
} from 'lucide-react'

const fmtAbrev = (v: number) => {
  if (Math.abs(v) >= 1_000_000) return `R$\u00a0${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `R$\u00a0${(v / 1_000).toFixed(0)}K`
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export default async function DashboardPage() {
  let userId: string | null = null
  let orgId: string | null = null
  try {
    const authResult = await auth()
    userId = authResult.userId
    orgId = authResult.orgId ?? null
  } catch {
    redirect('/sign-in')
  }
  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/onboarding')

  const empresa = await db.query.empresas.findFirst({ where: eq(empresas.organizationId, orgId) })
  if (!empresa) redirect('/onboarding')

  const [{ total: totalF }] = await db
    .select({ total: count() }).from(fornecedores)
    .where(and(eq(fornecedores.empresaId, empresa.id), eq(fornecedores.ativo, true)))

  const [{ total: enrichedF }] = await db
    .select({ total: count() }).from(fornecedores)
    .where(and(eq(fornecedores.empresaId, empresa.id), eq(fornecedores.statusEnriquecimento, 'concluido')))

  const recentes = await db.query.novidades.findMany({
    where: eq(novidades.ativo, true),
    orderBy: [desc(novidades.dataPublicacao)],
    limit: 5,
  })

  let sim2027 = null
  if (empresa.faturamentoAnual && empresa.aliquotaIcmsAtual && empresa.aliquotaIssAtual) {
    try {
      sim2027 = calcularImpacto({
        ano: 2027, regime: empresa.regime, setor: empresa.setor,
        faturamentoAnual: parseFloat(empresa.faturamentoAnual),
        aliquotaIcms: parseFloat(empresa.aliquotaIcmsAtual),
        aliquotaIss: parseFloat(empresa.aliquotaIssAtual),
      })
    } catch { /* silencioso */ }
  }

  const pctEnr = totalF > 0 ? Math.round((enrichedF / totalF) * 100) : 0
  const variacao = sim2027?.variacaoPercentual ?? 0
  const tend = variacao > 1 ? 'alta' : variacao < -1 ? 'queda' : 'neutro'
  const alertas = recentes.filter((n) => n.nivelImpacto === 'alto').length

  return (
    <div className="space-y-6">

      {alertas > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              {alertas} {alertas === 1 ? 'novidade de alto impacto' : 'novidades de alto impacto'} publicadas recentemente
            </p>
            <p className="text-xs text-amber-700 mt-0.5">Recomendamos revisar antes de tomar decisões tributárias.</p>
          </div>
          <Link href="/novidades" className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1">
            Ver <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Perfil */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">Perfil</p>
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="num text-xl font-bold text-foreground leading-tight">{labelRegime(empresa.regime)}</p>
          <p className="text-sm text-muted-foreground mt-1">{labelSetor(empresa.setor)}</p>
          <div className="mt-3 pt-3 border-t border-border/60">
            <p className="text-xs text-muted-foreground/70 truncate">{empresa.razaoSocial ?? 'Empresa'}</p>
          </div>
        </div>

        {/* Carga atual */}
        {sim2027 ? (
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">Carga Atual</p>
              <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                <Minus className="w-4 h-4 text-muted-foreground/70" />
              </div>
            </div>
            <p className="num text-xl font-bold text-foreground">{fmtAbrev(sim2027.cargaAtual)}</p>
            <p className="text-sm text-muted-foreground mt-1">PIS/COFINS + ICMS + ISS</p>
            <div className="mt-3 pt-3 border-t border-border/60">
              <p className="text-xs text-muted-foreground/70">Base: faturamento anual declarado</p>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-dashed border-border p-5 flex flex-col justify-between">
            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-3">Carga Atual</p>
            <p className="text-sm text-muted-foreground/70">Complete o perfil no simulador</p>
            <Link href="/simulador" className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline">
              Abrir simulador <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}

        {/* Carga futura */}
        {sim2027 ? (
          <div className={`bg-card rounded-2xl border p-5 shadow-sm ${
            tend === 'alta' ? 'border-red-200' : tend === 'queda' ? 'border-green-200' : 'border-border'
          }`}>
            <div className="flex items-start justify-between mb-3">
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">Carga em 2027</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                tend === 'alta' ? 'bg-red-50' : tend === 'queda' ? 'bg-green-50' : 'bg-muted'
              }`}>
                {tend === 'alta' ? <TrendingUp className="w-4 h-4 text-red-500" />
                  : tend === 'queda' ? <TrendingDown className="w-4 h-4 text-green-600" />
                  : <Minus className="w-4 h-4 text-muted-foreground/70" />}
              </div>
            </div>
            <p className="num text-xl font-bold text-foreground">{fmtAbrev(sim2027.cargaFutura)}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`num text-sm font-bold ${variacao > 0 ? 'text-red-600' : variacao < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                {variacao > 0 ? '+' : ''}{variacao.toFixed(1)}%
              </span>
              <span className="text-sm text-muted-foreground/70">vs. sistema atual</span>
            </div>
            <div className="mt-3 pt-3 border-t border-border/60">
              <p className="text-xs text-muted-foreground/70">CBS + IBS — primeiro ano pleno</p>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-dashed border-border p-5">
            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-3">Carga em 2027</p>
            <p className="text-sm text-muted-foreground/70">Preencha os dados para simular</p>
          </div>
        )}

        {/* Fornecedores */}
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest">Fornecedores</p>
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <p className="num text-xl font-bold text-foreground">{totalF.toLocaleString('pt-BR')}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {pctEnr === 100 ? <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              : pctEnr > 0 ? <Clock className="w-3.5 h-3.5 text-amber-500" />
              : null}
            <p className="text-sm text-muted-foreground">{pctEnr}% enriquecidos</p>
          </div>
          <div className="mt-3 pt-3 border-t border-border/60">
            {totalF > 0 ? (
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pctEnr}%` }} />
              </div>
            ) : (
              <Link href="/fornecedores/importar" className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
                Importar fornecedores <ArrowRight className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Ações rápidas */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-3">Acesso Rápido</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href="/simulador" className="group flex items-center gap-4 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl p-5 hover:from-blue-500 hover:to-blue-700 transition-all shadow-sm shadow-blue-600/20">
            <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Simulador Tributário</p>
              <p className="text-blue-200 text-xs mt-0.5">Calcule o impacto 2026–2033</p>
            </div>
            <ArrowRight className="w-4 h-4 text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </Link>

          <Link href="/fornecedores/importar" className="group flex items-center gap-4 bg-card border border-border rounded-2xl p-5 hover:border-indigo-200 hover:shadow-sm transition-all">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">Importar Fornecedores</p>
              <p className="text-muted-foreground/70 text-xs mt-0.5">CSV/XLSX até 15.000 CNPJs</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </Link>

          <Link href="/agente" className="group flex items-center gap-4 bg-card border border-border rounded-2xl p-5 hover:border-purple-200 hover:shadow-sm transition-all">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">Agente IA</p>
              <p className="text-muted-foreground/70 text-xs mt-0.5">Dúvidas sobre a Reforma</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/70 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </Link>
        </div>
      </div>

      {/* Novidades */}
      {recentes.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-foreground text-sm">Últimas Novidades Legislativas</h2>
              <p className="text-xs text-muted-foreground/70 mt-0.5">DOU · Receita Federal · CGIBS</p>
            </div>
            <Link href="/novidades" className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-border/60">
            {recentes.map((n) => (
              <div key={n.id} className="flex items-start gap-4 px-6 py-4 hover:bg-accent/50 transition-colors">
                <span className={`mt-0.5 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                  n.nivelImpacto === 'alto' ? 'bg-red-100 text-red-700'
                    : n.nivelImpacto === 'medio' ? 'bg-amber-100 text-amber-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  {n.nivelImpacto === 'alto' ? '● Alto' : n.nivelImpacto === 'medio' ? '● Médio' : '● Baixo'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{n.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.resumo?.slice(0, 120)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
