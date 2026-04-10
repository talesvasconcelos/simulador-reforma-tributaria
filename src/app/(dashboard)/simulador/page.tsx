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
  pisCofinsRegime: 'cumulativo' | 'nao_cumulativo'
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
    pisCofinsRegime: 'cumulativo',
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

  // Recalcula automaticamente ao trocar ano ou qualquer parâmetro (debounce 400ms para inputs numéricos)
  useEffect(() => {
    const t = setTimeout(calcular, 400)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anoSelecionado, params.regime, params.setor, params.faturamentoAnual, params.aliquotaIcms, params.aliquotaIss, params.comprasAnuais, params.isExportadora, params.pisCofinsRegime])

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

              {/* Comparativo PIS/COFINS antes de 2027 vs CBS 8,8% a partir de 2027 */}
              {resultado.comparativoCbs && (
                <div className="bg-card rounded-2xl border border-indigo-200 dark:border-indigo-800/60 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-indigo-100 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-900/10">
                    <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                      Impacto da CBS sobre o PIS/COFINS — {anoSelecionado}
                    </h3>
                    <p className="text-xs text-indigo-700/70 dark:text-indigo-300/70 mt-0.5">
                      A partir de 2027, PIS e COFINS são extintos e substituídos pela CBS 8,8% para todos (Lucro Real e Presumido) — sem opção de regime. Veja o impacto conforme o PIS/COFINS que sua empresa recolhia antes.
                    </p>
                  </div>

                  {/* CBS futuro — igual para todos */}
                  <div className="px-5 py-4 border-b border-border/60 bg-muted/30">
                    <div className="flex flex-wrap items-center gap-6 text-sm">
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-0.5">CBS a partir de 2027</p>
                        <p className="num text-xl font-bold text-indigo-600">{formatarMoeda(resultado.comparativoCbs.cbsLiquido)}</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">8,8% bruto − crédito de compras</p>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div className="flex gap-4">
                          <span>CBS bruto (8,8%)</span>
                          <span className="num font-medium text-foreground">{formatarMoeda(resultado.comparativoCbs.cbsBruto)}</span>
                        </div>
                        <div className="flex gap-4">
                          <span>(−) Crédito nas compras</span>
                          <span className="num font-medium text-green-600">−{formatarMoeda(resultado.comparativoCbs.creditoAproveitado)}</span>
                        </div>
                        <div className="flex gap-4">
                          <span>Compras / faturamento</span>
                          <span className="font-medium text-foreground">{resultado.comparativoCbs.comprasFaturamentoRatio.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Comparativo por regime anterior */}
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/60">
                    {/* Se era PIS/COFINS Cumulativo */}
                    <div className="p-5 space-y-3">
                      <div>
                        <p className="text-xs font-bold text-foreground">Se sua empresa era PIS/COFINS Cumulativo</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">PIS 0,65% + COFINS 3,00% = 3,65% — Lei 9.718/98 (sem crédito de entradas)</p>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">PIS/COFINS antes (3,65%)</span>
                          <span className="num">{formatarMoeda(resultado.comparativoCbs.seCumulativo.pisCofinsAntes)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border/60 pt-1.5">
                          <span className="text-muted-foreground">CBS 8,8% líquido</span>
                          <span className="num font-bold text-foreground">{formatarMoeda(resultado.comparativoCbs.cbsLiquido)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground font-semibold">Variação</span>
                          <span className={`num font-bold ${resultado.comparativoCbs.seCumulativo.impacto === 'reducao' ? 'text-green-600' : resultado.comparativoCbs.seCumulativo.impacto === 'aumento' ? 'text-red-500' : 'text-foreground'}`}>
                            {resultado.comparativoCbs.seCumulativo.variacaoAbsoluta > 0 ? '+' : ''}
                            {formatarMoeda(resultado.comparativoCbs.seCumulativo.variacaoAbsoluta)}
                            {' '}
                            <span className="font-normal">
                              ({resultado.comparativoCbs.seCumulativo.variacaoPercentual > 0 ? '+' : ''}
                              {resultado.comparativoCbs.seCumulativo.variacaoPercentual.toFixed(1)}%)
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className={`text-[10px] font-medium px-2.5 py-1.5 rounded-lg ${resultado.comparativoCbs.seCumulativo.impacto === 'reducao' ? 'bg-green-100 text-green-800' : resultado.comparativoCbs.seCumulativo.impacto === 'aumento' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                        {resultado.comparativoCbs.seCumulativo.impacto === 'reducao'
                          ? 'CBS reduz a carga vs PIS/COFINS cumulativo — crédito nas compras compensa a alíquota maior.'
                          : resultado.comparativoCbs.seCumulativo.impacto === 'aumento'
                            ? 'CBS aumenta a carga vs PIS/COFINS cumulativo — volume de compras insuficiente para absorver a alíquota de 8,8%.'
                            : 'Carga praticamente neutra.'}
                      </div>
                    </div>

                    {/* Se era PIS/COFINS Não-Cumulativo */}
                    <div className="p-5 space-y-3">
                      <div>
                        <p className="text-xs font-bold text-foreground">Se sua empresa era PIS/COFINS Não-Cumulativo</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">PIS 1,65% + COFINS 7,60% = 9,25% — Leis 10.637/02 e 10.833/03 (com crédito de entradas)</p>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">PIS/COFINS bruto (9,25%)</span>
                          <span className="num">{formatarMoeda(resultado.comparativoCbs.seNaoCumulativo.pisCofinsAntes)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">(−) Crédito entradas (9,25%)</span>
                          <span className="num text-green-600">−{formatarMoeda(resultado.comparativoCbs.seNaoCumulativo.pisCofinsAntes - resultado.comparativoCbs.seNaoCumulativo.pisCofinsLiquidoAntes)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">PIS/COFINS líquido antes</span>
                          <span className="num">{formatarMoeda(resultado.comparativoCbs.seNaoCumulativo.pisCofinsLiquidoAntes)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border/60 pt-1.5">
                          <span className="text-muted-foreground">CBS 8,8% líquido</span>
                          <span className="num font-bold text-foreground">{formatarMoeda(resultado.comparativoCbs.cbsLiquido)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground font-semibold">Variação</span>
                          <span className={`num font-bold ${resultado.comparativoCbs.seNaoCumulativo.impacto === 'reducao' ? 'text-green-600' : resultado.comparativoCbs.seNaoCumulativo.impacto === 'aumento' ? 'text-red-500' : 'text-foreground'}`}>
                            {resultado.comparativoCbs.seNaoCumulativo.variacaoAbsoluta > 0 ? '+' : ''}
                            {formatarMoeda(resultado.comparativoCbs.seNaoCumulativo.variacaoAbsoluta)}
                            {' '}
                            <span className="font-normal">
                              ({resultado.comparativoCbs.seNaoCumulativo.variacaoPercentual > 0 ? '+' : ''}
                              {resultado.comparativoCbs.seNaoCumulativo.variacaoPercentual.toFixed(1)}%)
                            </span>
                          </span>
                        </div>
                      </div>
                      <div className={`text-[10px] font-medium px-2.5 py-1.5 rounded-lg ${resultado.comparativoCbs.seNaoCumulativo.impacto === 'reducao' ? 'bg-green-100 text-green-800' : resultado.comparativoCbs.seNaoCumulativo.impacto === 'aumento' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}`}>
                        {resultado.comparativoCbs.seNaoCumulativo.impacto === 'reducao'
                          ? 'CBS reduz a carga vs PIS/COFINS não-cumulativo — alíquota menor (8,8% vs 9,25%) favorece quem já tinha créditos.'
                          : resultado.comparativoCbs.seNaoCumulativo.impacto === 'aumento'
                            ? 'CBS aumenta levemente vs PIS/COFINS não-cumulativo.'
                            : 'Carga praticamente neutra.'}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-3 bg-muted/30 border-t border-border text-[10px] text-muted-foreground/70">
                    Referência legal: extinção do PIS/COFINS em 2027 — LC 214/2025, Art. 7° e Art. 9°. CBS com crédito integral sobre todas as compras tributadas na cadeia.
                  </div>
                </div>
              )}

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
