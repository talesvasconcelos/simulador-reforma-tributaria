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
              <select
                value={params.regime}
                onChange={(e) => {
                  const novoRegime = e.target.value
                  setParams((p) => ({
                    ...p,
                    regime: novoRegime,
                    // Lucro Real é sempre não-cumulativo; Presumido padrão cumulativo
                    pisCofinsRegime: novoRegime === 'lucro_real' ? 'nao_cumulativo' : 'cumulativo',
                  }))
                }}
                className={inputCls}
              >
                <option value="simples_nacional">Simples Nacional</option>
                <option value="mei">MEI</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="lucro_real">Lucro Real</option>
              </select>
            </div>

            {/* Seletor PIS/COFINS — apenas Lucro Presumido */}
            {params.regime === 'lucro_presumido' && (
              <div className="bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/60 rounded-xl p-3 space-y-2">
                <label className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wider block">
                  Regime PIS/COFINS (Lucro Presumido)
                </label>
                <div className="space-y-1.5">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pisCofinsRegime"
                      value="cumulativo"
                      checked={params.pisCofinsRegime === 'cumulativo'}
                      onChange={() => setParams((p) => ({ ...p, pisCofinsRegime: 'cumulativo' }))}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span className="text-xs text-foreground">
                      <strong>Cumulativo</strong> — PIS 0,65% + COFINS 3,00% = 3,65% (sem crédito)
                      <br />
                      <span className="text-muted-foreground/70">Lei 9.718/98 — padrão para a maioria das empresas</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="pisCofinsRegime"
                      value="nao_cumulativo"
                      checked={params.pisCofinsRegime === 'nao_cumulativo'}
                      onChange={() => setParams((p) => ({ ...p, pisCofinsRegime: 'nao_cumulativo' }))}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span className="text-xs text-foreground">
                      <strong>Não-cumulativo</strong> — PIS 1,65% + COFINS 7,60% = 9,25% (com crédito)
                      <br />
                      <span className="text-muted-foreground/70">Lei 10.637/02 e 10.833/03 — vantajoso com muitos insumos</span>
                    </span>
                  </label>
                </div>
              </div>
            )}
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

              {/* Comparativo CBS cumulativo vs não-cumulativo — Lucro Presumido */}
              {resultado.comparativoCbs && (
                <div className="bg-card rounded-2xl border border-blue-200 dark:border-blue-800/60 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-blue-100 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-900/10">
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                      Opção CBS — Cumulativo vs Não-Cumulativo ({anoSelecionado})
                    </h3>
                    <p className="text-xs text-blue-700/70 dark:text-blue-300/70 mt-0.5">
                      LC 214/2025, Art. 9 §6° — Lucro Presumido pode optar pela CBS cumulativa (3,65%) ou migrar para a não-cumulativa (8,8% com crédito)
                    </p>
                  </div>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Opção A: Cumulativo */}
                    <div className={`rounded-xl border p-4 space-y-3 ${resultado.comparativoCbs.recomendacao === 'manter_cumulativo' ? 'border-green-300 bg-green-50 dark:bg-green-900/15' : 'border-border bg-muted/30'}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground uppercase tracking-wide">CBS Cumulativa</p>
                        {resultado.comparativoCbs.recomendacao === 'manter_cumulativo' && (
                          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">RECOMENDADO</span>
                        )}
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Alíquota CBS</span>
                          <span className="font-semibold">3,65% (sem crédito)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">PIS/COFINS hoje</span>
                          <span className="num font-medium">{formatarMoeda(resultado.comparativoCbs.opcaoCumulativa.pisCofinsAtual)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border/60 pt-1.5">
                          <span className="text-muted-foreground">CBS futuro</span>
                          <span className="num font-bold text-foreground">{formatarMoeda(resultado.comparativoCbs.opcaoCumulativa.cbsFuturo)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Variação</span>
                          <span className={`num font-semibold ${resultado.comparativoCbs.opcaoCumulativa.variacaoAbsoluta <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {resultado.comparativoCbs.opcaoCumulativa.variacaoAbsoluta > 0 ? '+' : ''}
                            {formatarMoeda(resultado.comparativoCbs.opcaoCumulativa.variacaoAbsoluta)}
                            {' '}({resultado.comparativoCbs.opcaoCumulativa.variacaoPercentual > 0 ? '+' : ''}
                            {resultado.comparativoCbs.opcaoCumulativa.variacaoPercentual.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                        Mantém a mesma lógica do PIS/COFINS cumulativo atual. Sem aproveitamento de crédito nas compras. Base legal: Art. 9 §6° LC 214/2025.
                      </p>
                    </div>

                    {/* Opção B: Não-cumulativo */}
                    <div className={`rounded-xl border p-4 space-y-3 ${resultado.comparativoCbs.recomendacao === 'migrar_nao_cumulativo' ? 'border-green-300 bg-green-50 dark:bg-green-900/15' : 'border-border bg-muted/30'}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-foreground uppercase tracking-wide">CBS Não-Cumulativa</p>
                        {resultado.comparativoCbs.recomendacao === 'migrar_nao_cumulativo' && (
                          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">RECOMENDADO</span>
                        )}
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Alíquota CBS</span>
                          <span className="font-semibold">8,8% com crédito integral</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">CBS bruto</span>
                          <span className="num">{formatarMoeda(resultado.comparativoCbs.opcaoNaoCumulativa.cbsBruto)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">(-) Crédito compras</span>
                          <span className="num text-green-600 font-medium">-{formatarMoeda(resultado.comparativoCbs.opcaoNaoCumulativa.creditoAproveitado)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border/60 pt-1.5">
                          <span className="text-muted-foreground">CBS líquido</span>
                          <span className="num font-bold text-foreground">{formatarMoeda(resultado.comparativoCbs.opcaoNaoCumulativa.cbsLiquido)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">vs PIS/COFINS cumulativo atual</span>
                          <span className={`num font-semibold ${resultado.comparativoCbs.opcaoNaoCumulativa.variacaoVsAtualCumulativo <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {resultado.comparativoCbs.opcaoNaoCumulativa.variacaoVsAtualCumulativo > 0 ? '+' : ''}
                            {formatarMoeda(resultado.comparativoCbs.opcaoNaoCumulativa.variacaoVsAtualCumulativo)}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                        Vantajoso quando compras/faturamento &gt; {resultado.comparativoCbs.pontoEquilibrio}%. Sua empresa está em {resultado.comparativoCbs.comprasFaturamentoRatio.toFixed(0)}%. Base legal: Art. 9 caput LC 214/2025.
                      </p>
                    </div>
                  </div>

                  {/* Conclusão */}
                  <div className={`px-5 py-3 border-t text-xs font-medium ${resultado.comparativoCbs.recomendacao === 'migrar_nao_cumulativo' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 text-green-800 dark:text-green-300' : 'bg-muted/50 border-border text-muted-foreground'}`}>
                    {resultado.comparativoCbs.recomendacao === 'migrar_nao_cumulativo' ? (
                      <>
                        Migrar para CBS não-cumulativa pode reduzir o CBS em{' '}
                        <strong>{formatarMoeda(Math.abs(resultado.comparativoCbs.economiaAnualComMigracao))}/ano</strong>.
                        Consulte seu contador — a opção é irrevogável dentro do ano-calendário.
                      </>
                    ) : (
                      <>
                        Manter CBS cumulativa é mais vantajoso para seu volume de compras.
                        Ponto de equilíbrio: compras devem superar <strong>{resultado.comparativoCbs.pontoEquilibrio}%</strong> do faturamento para a não-cumulativa compensar.
                      </>
                    )}
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
