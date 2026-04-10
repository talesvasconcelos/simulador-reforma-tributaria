'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatarMoeda, formatarPercentual } from '@/lib/utils'
import type { ResultadoCalculo, ProjecaoTransicao } from '@/types/simulador'

interface FormParams {
  regime: string
  setor: string
  faturamentoAnual: number
  aliquotaIcms: number
  aliquotaIss: number
  comprasAnuais: number
  isExportadora: boolean
}

export default function SimuladorPage() {
  const [params, setParams] = useState<FormParams>({
    regime: 'lucro_presumido',
    setor: 'servicos',
    faturamentoAnual: 1000000,
    aliquotaIcms: 12,
    aliquotaIss: 5,
    comprasAnuais: 400000,
    isExportadora: false,
  })
  const [anoSelecionado, setAnoSelecionado] = useState(2027)
  const [resultado, setResultado] = useState<ResultadoCalculo | null>(null)
  const [projecao, setProjecao] = useState<ProjecaoTransicao | null>(null)
  const [carregando, setCarregando] = useState(false)

  const calcular = async () => {
    setCarregando(true)
    try {
      const [resCalculo, resProjecao] = await Promise.all([
        fetch('/api/simulador/calcular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...params, ano: anoSelecionado }),
        }).then((r) => r.json()),
        fetch('/api/simulador/projecao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        }).then((r) => r.json()),
      ])
      setResultado(resCalculo)
      setProjecao(resProjecao)
    } catch (e) {
      console.error(e)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    calcular()
  }, [])

  const anos = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

  const dadosGraficoProjecao = projecao?.anos.map((r) => ({
    ano: r.ano,
    'Carga Atual': Math.round(r.cargaAtual),
    'Carga Futura': Math.round(r.cargaFutura),
  })) ?? []

  const dadosGraficoComparativo = resultado
    ? [
        { tributo: 'PIS', atual: Math.round(resultado.tributosAtuais.pis), futuro: 0 },
        { tributo: 'COFINS', atual: Math.round(resultado.tributosAtuais.cofins), futuro: 0 },
        { tributo: 'ICMS', atual: Math.round(resultado.tributosAtuais.icms), futuro: 0 },
        { tributo: 'ISS', atual: Math.round(resultado.tributosAtuais.iss), futuro: 0 },
        { tributo: 'CBS', atual: 0, futuro: Math.round(resultado.tributosNovos.cbs) },
        { tributo: 'IBS', atual: 0, futuro: Math.round(resultado.tributosNovos.ibs) },
      ]
    : []

  const inputCls = 'w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow'
  const labelCls = 'text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* Painel de parâmetros */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 bg-muted/50">
            <h2 className="text-sm font-semibold text-foreground/80">Parâmetros da Empresa</h2>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Informe os dados para calcular o impacto</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className={labelCls}>Regime Tributário</label>
              <select value={params.regime} onChange={(e) => setParams((p) => ({ ...p, regime: e.target.value }))} className={inputCls}>
                <option value="simples_nacional">Simples Nacional</option>
                <option value="mei">MEI</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="lucro_real">Lucro Real</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Setor de Atividade</label>
              <select value={params.setor} onChange={(e) => setParams((p) => ({ ...p, setor: e.target.value }))} className={inputCls}>
                <option value="servicos">Serviços Gerais</option>
                <option value="profissionais_liberais">Profissionais Liberais</option>
                <option value="servicos_saude">Saúde</option>
                <option value="servicos_educacao">Educação</option>
                <option value="servicos_financeiros">Serviços Financeiros</option>
                <option value="industria">Indústria</option>
                <option value="comercio_varejo">Comércio Varejo</option>
                <option value="comercio_atacado">Comércio Atacado</option>
                <option value="agronegocio">Agronegócio</option>
                <option value="construcao_edificios">Construção — Edifícios</option>
                <option value="construcao_infraestrutura">Construção — Infraestrutura</option>
                <option value="construcao_servicos_especializados">Construção — Serv. Especializados</option>
                <option value="transporte_coletivo_passageiros">Transp. Coletivo Passageiros</option>
                <option value="transporte_cargas">Transporte de Cargas / Aéreo</option>
                <option value="imoveis">Atividades Imobiliárias</option>
                <option value="tecnologia">Tecnologia</option>
              </select>
            </div>

            <div className="pt-1 pb-1 border-t border-border/60">
              <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-3">Valores Anuais</p>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Faturamento (R$)</label>
                  <input type="number" value={params.faturamentoAnual} onChange={(e) => setParams((p) => ({ ...p, faturamentoAnual: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Compras (R$)</label>
                  <input type="number" value={params.comprasAnuais} onChange={(e) => setParams((p) => ({ ...p, comprasAnuais: Number(e.target.value) }))} className={inputCls} />
                </div>
              </div>
            </div>

            <div className="pt-1 pb-1 border-t border-border/60">
              <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-3">Alíquotas Atuais</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>ICMS (%)</label>
                  <input type="number" step="0.5" value={params.aliquotaIcms} onChange={(e) => setParams((p) => ({ ...p, aliquotaIcms: Number(e.target.value) }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>ISS (%)</label>
                  <input type="number" step="0.5" value={params.aliquotaIss} onChange={(e) => setParams((p) => ({ ...p, aliquotaIss: Number(e.target.value) }))} className={inputCls} />
                </div>
              </div>
            </div>

            <button
              onClick={calcular}
              disabled={carregando}
              className="w-full bg-gradient-to-br from-blue-600 to-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold hover:from-blue-500 hover:to-blue-700 transition-all shadow-sm shadow-blue-600/20 disabled:opacity-60"
            >
              {carregando ? 'Calculando...' : 'Calcular Impacto'}
            </button>
          </div>
        </div>

        {/* Área de resultados */}
        <div className="lg:col-span-2 space-y-4">

          {/* Seletor de ano */}
          <div className="flex gap-1.5 flex-wrap bg-card rounded-2xl border border-border p-2 shadow-sm">
            {anos.map((ano) => (
              <button
                key={ano}
                onClick={() => { setAnoSelecionado(ano); calcular() }}
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

          {resultado && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                  <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Carga Atual</p>
                  <p className="num text-lg font-bold text-foreground tabular-nums">{formatarMoeda(resultado.cargaAtual)}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Sistema vigente</p>
                </div>
                <div className={`bg-card rounded-2xl border p-4 shadow-sm ${resultado.variacaoPercentual > 0 ? 'border-red-200' : 'border-green-200'}`}>
                  <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Carga {anoSelecionado}</p>
                  <p className="num text-lg font-bold text-foreground tabular-nums">{formatarMoeda(resultado.cargaFutura)}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Novo sistema</p>
                </div>
                <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                  <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Variação</p>
                  <p className={`num text-lg font-bold tabular-nums ${resultado.variacaoPercentual > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {resultado.variacaoPercentual > 0 ? '+' : ''}{resultado.variacaoPercentual.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">vs. sistema atual</p>
                </div>
                <div className="bg-card rounded-2xl border border-green-200 p-4 shadow-sm">
                  <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Créditos</p>
                  <p className="num text-lg font-bold text-green-600 tabular-nums">{formatarMoeda(resultado.creditos.totalCredito)}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">CBS + IBS estimado</p>
                </div>
              </div>

              {/* Alertas */}
              {resultado.alertas.length > 0 && (
                <div className="space-y-2">
                  {resultado.alertas.map((alerta, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-sm">
                      <span className="text-blue-500 font-bold flex-shrink-0">ℹ</span>
                      {alerta}
                    </div>
                  ))}
                </div>
              )}

              {/* Gráfico comparativo */}
              <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-semibold text-foreground text-sm">Comparativo por Tributo — {anoSelecionado}</h3>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">Sistema atual (cinza) vs. novo (azul)</p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dadosGraficoComparativo} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="tributo" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}K`} />
                    <Tooltip formatter={(value) => formatarMoeda(Number(value))} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                    <Bar dataKey="atual" name="Sistema Atual" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="futuro" name="Sistema Novo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Gráfico de projeção */}
          {projecao && (
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <div className="mb-4">
                <h3 className="font-semibold text-foreground text-sm">Projeção da Carga Tributária — 2026 a 2033</h3>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Transição gradual do sistema atual para o novo</p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={dadosGraficoProjecao}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="ano" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(value) => formatarMoeda(Number(value))} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                  <Line type="monotone" dataKey="Carga Atual" stroke="#cbd5e1" strokeWidth={2} strokeDasharray="6 3" dot={false} />
                  <Line type="monotone" dataKey="Carga Futura" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
