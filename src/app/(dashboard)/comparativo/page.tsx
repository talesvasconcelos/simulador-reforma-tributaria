'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Line, ComposedChart,
} from 'recharts'
import { AlertCircle, ArrowRight, TrendingDown, TrendingUp } from 'lucide-react'
import { formatarMoeda } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ProjecaoAno {
  ano: number
  faturamentoAnual: number
  gastosMensaisAnual: number
  cbsIbsBrutoAnual: number
  icmsIssRestanteAnual: number
  creditosAnual: number
  cargaTributariaLiquidaAnual: number
  resultadoLiquidoAnual: number
  variacaoVs2025: number
  isReferencia: boolean
}

interface DadosComparativo {
  anoReferencia: number
  faturamento: {
    mediaMensal: number
    totalAnual: number
    pctB2B: number
    pctPublico: number
    pctB2C: number
    mesesComDados: number
    temDados: boolean
  }
  gastos: {
    totalMensal: number
    totalAnual: number
    fornecedoresComValor: number
    totalFornecedores: number
    creditosMensaisPotenciais2027: number
    percentualCreditoSobreGastos: number
  }
  projecao: ProjecaoAno[]
  empresa: {
    razaoSocial: string
    regime: string
    setor: string
    uf: string
  }
}

function variacaoBadge(variacao: number) {
  if (variacao === 0) return null
  const cor = variacao > 0 ? 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400'
  const icone = variacao > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />
  return (
    <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold', cor)}>
      {icone}
      {variacao > 0 ? '+' : ''}{variacao.toFixed(1)}%
    </span>
  )
}

const formatarMilhoes = (valor: number) => {
  if (Math.abs(valor) >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1)}M`
  if (Math.abs(valor) >= 1_000) return `R$ ${(valor / 1_000).toFixed(0)}K`
  return `R$ ${valor.toFixed(0)}`
}

export default function ComparativoPage() {
  const [dados, setDados] = useState<DadosComparativo | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/comparativo?ano=2025')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setDados(d)
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false))
  }, [])

  if (carregando) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded-xl" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="h-72 bg-muted animate-pulse rounded-2xl" />
      </div>
    )
  }

  if (erro || !dados) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800 rounded-2xl text-red-700 dark:text-red-400">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        {erro ?? 'Não foi possível carregar os dados.'}
      </div>
    )
  }

  const { faturamento, gastos, projecao, empresa } = dados
  const carga2025 = projecao.find((p) => p.ano === 2025)?.cargaTributariaLiquidaAnual ?? 0
  const carga2027 = projecao.find((p) => p.ano === 2027)?.cargaTributariaLiquidaAnual ?? 0
  const var2027vs2025 = carga2025 > 0 ? ((carga2027 - carga2025) / carga2025) * 100 : 0

  const dadosGrafico = projecao.map((p) => ({
    ano: p.ano.toString(),
    'Gastos ×12': Math.round(p.gastosMensaisAnual / 1000),
    'Carga tributária': Math.round(p.cargaTributariaLiquidaAnual / 1000),
    'Créditos CBS/IBS': Math.round(p.creditosAnual / 1000),
    'Resultado líquido': Math.round(p.resultadoLiquidoAnual / 1000),
  }))

  const splitPaymentReserva = gastos.creditosMensaisPotenciais2027 * 1.5

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          Comparativo Realizado × Reforma
        </h1>
        <p className="text-muted-foreground/70 text-xs mt-0.5">
          Baseado nos seus dados reais de {dados.anoReferencia} projetados até 2033 — {empresa.razaoSocial}
        </p>
      </div>

      {/* Banner sem dados */}
      {!faturamento.temDados && (
        <div className="flex items-center gap-4 p-4 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/60 rounded-2xl">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              Importe seus dados de faturamento para ver a análise completa
            </p>
            <p className="text-xs text-amber-700/70 dark:text-amber-300/70 mt-0.5">
              Usando estimativa com base no faturamento anual cadastrado.
            </p>
          </div>
          <Link
            href="/faturamento/importar"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0"
          >
            Importar <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground/70 font-medium">Faturamento médio/mês</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 num mt-1">
            {formatarMoeda(faturamento.mediaMensal)}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">
            {faturamento.temDados
              ? `${faturamento.mesesComDados} mes${faturamento.mesesComDados > 1 ? 'es' : ''} importados`
              : 'Estimativa cadastro'}
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground/70 font-medium">Gastos fornecedores/mês</p>
          <p className="text-xl font-bold text-slate-700 dark:text-slate-300 num mt-1">
            {formatarMoeda(gastos.totalMensal)}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">
            {gastos.fornecedoresComValor} de {gastos.totalFornecedores} fornecedores com valor
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground/70 font-medium">Carga tributária 2025/mês</p>
          <p className="text-xl font-bold text-gray-700 dark:text-gray-300 num mt-1">
            {formatarMoeda(carga2025 / 12)}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">Sistema atual</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground/70 font-medium">Carga tributária 2027/mês</p>
          <p className={cn(
            'text-xl font-bold num mt-1',
            var2027vs2025 > 5 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
          )}>
            {formatarMoeda(carga2027 / 12)}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            {variacaoBadge(var2027vs2025)}
            <span className="text-[11px] text-muted-foreground/50">vs 2025</span>
          </div>
        </div>
      </div>

      {/* Dados base */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Dados base</p>
          <Link
            href="/faturamento/importar"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {faturamento.temDados ? 'Atualizar dados' : 'Importar dados reais'}
          </Link>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">B2B Privado</span>
            <span className="font-semibold num">{faturamento.pctB2B}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div className="flex h-full">
              <div className="bg-blue-500 h-full transition-all" style={{ width: `${faturamento.pctB2B}%` }} />
              <div className="bg-violet-500 h-full transition-all" style={{ width: `${faturamento.pctPublico}%` }} />
              <div className="bg-slate-400 h-full transition-all" style={{ width: `${faturamento.pctB2C}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground/70">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />{faturamento.pctB2B}% B2B</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />{faturamento.pctPublico}% Público</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />{faturamento.pctB2C}% B2C</span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/50">
          {faturamento.temDados
            ? `Dados importados — ${faturamento.mesesComDados} meses de ${dados.anoReferencia}`
            : 'Estimativa — baseado no faturamento cadastrado. Importe dados reais para análise precisa.'}
        </p>
      </div>

      {/* Gráfico comparativo */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-foreground">Evolução anual 2025–2033</p>
        <p className="text-xs text-muted-foreground/60">Valores em R$ mil/ano</p>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={dadosGrafico} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}K`} />
            <Tooltip
              formatter={(value: unknown) => {
                const v = typeof value === 'number' ? value : Number(value)
                return `R$ ${v.toLocaleString('pt-BR')}K`
              }}
              contentStyle={{ fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Gastos ×12" fill="#94a3b8" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Carga tributária" fill="#ef4444" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Créditos CBS/IBS" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="Resultado líquido" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela ano a ano */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-border">
          <p className="text-sm font-semibold text-foreground">Projeção ano a ano</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground/70">Ano</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground/70">Faturamento</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground/70">Gastos</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground/70">CBS+IBS bruto</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground/70">ICMS/ISS vigente</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground/70">Créditos</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground/70">Carga total</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground/70">Resultado líquido</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground/70">Δ carga</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {projecao.map((p) => (
                <tr
                  key={p.ano}
                  className={cn(
                    'transition-colors',
                    p.isReferencia
                      ? 'bg-amber-50/60 dark:bg-amber-900/10'
                      : p.ano === 2027
                      ? 'bg-blue-50/60 dark:bg-blue-900/10'
                      : 'hover:bg-muted/30'
                  )}
                >
                  <td className="px-4 py-3 font-bold text-foreground">
                    {p.ano}
                    {p.isReferencia && (
                      <span className="ml-1.5 text-[10px] font-normal text-amber-600 dark:text-amber-400">ref.</span>
                    )}
                    {p.ano === 2027 && (
                      <span className="ml-1.5 text-[10px] font-normal text-blue-600 dark:text-blue-400">CBS plena</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right num text-foreground/80">{formatarMilhoes(p.faturamentoAnual)}</td>
                  <td className="px-4 py-3 text-right num text-slate-600 dark:text-slate-400">{formatarMilhoes(p.gastosMensaisAnual)}</td>
                  <td className="px-4 py-3 text-right num text-orange-600 dark:text-orange-400">{formatarMilhoes(p.cbsIbsBrutoAnual)}</td>
                  <td className="px-4 py-3 text-right num text-orange-700 dark:text-orange-300">{formatarMilhoes(p.icmsIssRestanteAnual)}</td>
                  <td className="px-4 py-3 text-right num text-emerald-600 dark:text-emerald-400">
                    {p.creditosAnual > 0 ? `-${formatarMilhoes(p.creditosAnual)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right num font-semibold text-red-600 dark:text-red-400">{formatarMilhoes(p.cargaTributariaLiquidaAnual)}</td>
                  <td className="px-4 py-3 text-right num font-semibold text-foreground">{formatarMilhoes(p.resultadoLiquidoAnual)}</td>
                  <td className="px-4 py-3 text-center">
                    {p.isReferencia ? (
                      <span className="text-muted-foreground/40">base</span>
                    ) : (
                      variacaoBadge(p.variacaoVs2025)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Oportunidades */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Créditos potenciais 2027 */}
        <div className="bg-emerald-50 dark:bg-emerald-900/15 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-5 space-y-2">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 uppercase tracking-wide">
            Créditos potenciais 2027
          </p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 num">
            {formatarMoeda(gastos.creditosMensaisPotenciais2027)}<span className="text-sm font-normal">/mês</span>
          </p>
          <p className="text-xs text-emerald-700/70 dark:text-emerald-300/70">
            Créditos CBS/IBS de fornecedores elegíveis — {gastos.percentualCreditoSobreGastos.toFixed(1)}% do total de gastos.
          </p>
          {gastos.fornecedoresComValor === 0 && (
            <Link href="/fornecedores/importar" className="text-xs text-emerald-700 dark:text-emerald-300 underline">
              Importe fornecedores para calcular
            </Link>
          )}
        </div>

        {/* Split payment */}
        <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-5 space-y-2">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
            Reserva split payment
          </p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 num">
            {formatarMoeda(splitPaymentReserva)}<span className="text-sm font-normal">/mês</span>
          </p>
          <p className="text-xs text-amber-700/70 dark:text-amber-300/70">
            Capital de giro recomendado (45 dias) para cobrir o período entre retenção via split payment e ressarcimento dos créditos.
          </p>
        </div>

        {/* Impacto 2027 */}
        <div className={cn(
          'rounded-2xl p-5 space-y-2 border',
          var2027vs2025 > 0
            ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/60'
            : 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/60'
        )}>
          <p className={cn(
            'text-xs font-semibold uppercase tracking-wide',
            var2027vs2025 > 0 ? 'text-red-800 dark:text-red-200' : 'text-emerald-800 dark:text-emerald-200'
          )}>
            Impacto tributário 2027
          </p>
          <div className="flex items-baseline gap-2">
            <p className={cn(
              'text-2xl font-bold num',
              var2027vs2025 > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'
            )}>
              {var2027vs2025 > 0 ? '+' : ''}{var2027vs2025.toFixed(1)}%
            </p>
          </div>
          <p className={cn(
            'text-xs',
            var2027vs2025 > 0 ? 'text-red-700/70 dark:text-red-300/70' : 'text-emerald-700/70 dark:text-emerald-300/70'
          )}>
            {var2027vs2025 > 0
              ? `Aumento de ${formatarMoeda(Math.abs(carga2027 - carga2025) / 12)}/mês na carga tributária vs sistema atual.`
              : `Redução de ${formatarMoeda(Math.abs(carga2027 - carga2025) / 12)}/mês na carga tributária vs sistema atual.`}
          </p>
        </div>
      </div>
    </div>
  )
}
