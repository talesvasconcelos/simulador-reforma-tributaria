'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatarMoeda, labelRegime, formatarCnpj } from '@/lib/utils'
import type { AnaliseEstrategica } from '@/types/fornecedor'

const recomendacaoBadge = {
  manter: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  renegociar: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  avaliar_substituto: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

const recomendacaoLabel = {
  manter: '● Manter',
  renegociar: '● Renegociar',
  avaliar_substituto: '● Avaliar substituto',
}

const anos = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

export default function EstrategiaPage() {
  const [anoSelecionado, setAnoSelecionado] = useState(2027)
  const [analises, setAnalises] = useState<AnaliseEstrategica[]>([])
  const [resumo, setResumo] = useState<{
    totalFornecedores: number
    totalCadastrados: number
    totalCreditoEstimadoAnual: number
    totalComprasMensais: number
    totalComprasAnuais: number
    fornecedoresComRisco: number
    fornecedoresParaRenegociar: number
    totalCreditoPerdidoMensal: number
    totalCreditoPerdidoAnual: number
    podeApropriarCredito: boolean
  } | null>(null)
  const [economiaAnual, setEconomiaAnual] = useState<Record<number, number>>({})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    setCarregando(true)
    fetch(`/api/estrategia?ano=${anoSelecionado}`)
      .then((r) => r.json())
      .then((d) => {
        setAnalises(d.analises ?? [])
        setResumo(d.resumo)
        setEconomiaAnual(d.economiaAnual ?? {})
        setCarregando(false)
      })
  }, [anoSelecionado])

  const dadosEconomia = Object.entries(economiaAnual).map(([ano, valor]) => ({
    ano: parseInt(ano),
    'Crédito Estimado': Math.round(valor),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Estratégia de Compras</h1>
        <p className="text-muted-foreground/70 text-xs mt-0.5">
          Custo efetivo líquido por fornecedor considerando créditos de CBS e IBS
        </p>
      </div>

      {/* Seletor de ano */}
      <div className="flex gap-1.5 flex-wrap bg-card rounded-2xl border border-border p-2 shadow-sm">
        {anos.map((ano) => (
          <button
            key={ano}
            onClick={() => setAnoSelecionado(ano)}
            className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
              anoSelecionado === ano
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground/80'
            }`}
          >
            {ano}
          </button>
        ))}
      </div>

      {resumo && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Fornecedores</p>
              <p className="num text-xl font-bold text-foreground">{resumo.totalCadastrados}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{resumo.totalFornecedores} com preço</p>
            </div>
            <div className="bg-card rounded-2xl border border-blue-200 dark:border-blue-800/60 p-4 shadow-sm min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Compras/mês</p>
              <p className="num text-base sm:text-xl font-bold text-blue-600 truncate">{formatarMoeda(resumo.totalComprasMensais)}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">total fornecedores</p>
            </div>
            <div className="bg-card rounded-2xl border border-indigo-200 dark:border-indigo-800/60 p-4 shadow-sm min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Compras/ano</p>
              <p className="num text-base sm:text-xl font-bold text-indigo-600 truncate">{formatarMoeda(resumo.totalComprasAnuais)}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">volume anual</p>
            </div>
            <div className="bg-card rounded-2xl border border-green-200 dark:border-green-800/60 p-4 shadow-sm min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Crédito/ano</p>
              <p className="num text-base sm:text-xl font-bold text-green-600 truncate">{formatarMoeda(resumo.totalCreditoEstimadoAnual)}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">CBS + IBS estimado</p>
            </div>
            <div className="bg-card rounded-2xl border border-amber-200 dark:border-amber-800/60 p-4 shadow-sm min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Renegociar</p>
              <p className="num text-xl font-bold text-amber-600">{resumo.fornecedoresParaRenegociar}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">oportunidades</p>
            </div>
            <div className="bg-card rounded-2xl border border-red-200 dark:border-red-800/60 p-4 shadow-sm min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Com risco</p>
              <p className="num text-xl font-bold text-red-600">{resumo.fornecedoresComRisco}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">custo &gt; preço</p>
            </div>
          </div>

          {/* Alerta de crédito não aproveitável — exibido apenas quando o comprador não pode apropriar */}
          {!resumo.podeApropriarCredito && resumo.totalCreditoPerdidoMensal > 0 && (
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800/60 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                  Crédito CBS+IBS não aproveitável pela sua empresa
                </p>
                <p className="text-xs text-orange-700/80 dark:text-orange-400/80 mt-0.5">
                  Como sua empresa não é Lucro Real/Presumido, não pode apropriar os créditos gerados pelos seus fornecedores.
                  Considere renegociar preços ou migrar de regime.
                </p>
              </div>
              <div className="flex gap-4 sm:text-right shrink-0">
                <div>
                  <p className="text-[11px] font-semibold text-orange-700/70 dark:text-orange-400/70 uppercase tracking-widest">Perdido/mês</p>
                  <p className="num text-xl font-bold text-orange-600 dark:text-orange-400">{formatarMoeda(resumo.totalCreditoPerdidoMensal)}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-orange-700/70 dark:text-orange-400/70 uppercase tracking-widest">Perdido/ano</p>
                  <p className="num text-xl font-bold text-orange-600 dark:text-orange-400">{formatarMoeda(resumo.totalCreditoPerdidoAnual)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Gráfico de projeção */}
          {dadosEconomia.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="font-semibold text-foreground text-sm">Crédito CBS+IBS estimado por ano</h2>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Projeção para toda a base de fornecedores</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dadosEconomia} barCategoryGap="35%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="ano" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v) => formatarMoeda(Number(v))} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Bar dataKey="Crédito Estimado" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Tabela de fornecedores */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 bg-muted/50">
          <h2 className="font-semibold text-foreground/80 text-sm">Ranking por Custo Efetivo — {anoSelecionado}</h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Ordenado do mais vantajoso ao mais oneroso</p>
        </div>
        {carregando ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Carregando análise...</div>
        ) : analises.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            Importe fornecedores e aguarde o enriquecimento para ver a análise.
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/50 border-b border-border/60">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Fornecedor</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Regime</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Preço/mês</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Crédito</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Custo efetivo</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {analises.map((a) => (
                <tr key={a.fornecedorId} className="hover:bg-accent/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground truncate max-w-xs">{a.nome}</p>
                    <p className="text-xs text-muted-foreground/60 font-mono num">{formatarCnpj(a.cnpj)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                      {labelRegime(a.regime)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-foreground num">{formatarMoeda(a.precoMedioMensal)}</td>
                  <td className="px-4 py-3 text-right">
                    {a.creditoVedado ? (
                      <span className="text-xs text-red-500 font-semibold">Vedado (Art. 283)</span>
                    ) : resumo && !resumo.podeApropriarCredito && a.creditoPotencialMensal > 0 ? (
                      <div>
                        <span className="text-orange-500 font-semibold num line-through opacity-60">{formatarMoeda(a.creditoPotencialMensal)}</span>
                        <p className="text-[10px] text-orange-500/80 leading-tight">não aproveitável</p>
                      </div>
                    ) : (
                      <>
                        <span className="text-green-600 font-semibold num">{formatarMoeda(a.creditoMensal)}</span>
                        <span className="text-xs text-muted-foreground/50 ml-1 num">
                          ({a.percentualCredito.toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground num">
                    {formatarMoeda(a.custoEfetivo)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      recomendacaoBadge[a.recomendacao]
                    }`}>
                      {recomendacaoLabel[a.recomendacao]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
