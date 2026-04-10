'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { formatarMoeda, labelSetor, labelRegime } from '@/lib/utils'
import type { ResultadoAnaliseFaturamento, EstrategiaRecomendada } from '@/lib/simulador/analise-clientes'

const anos = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

const prioridadeBadge = {
  alta: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  baixa: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
}

const tipoIcon: Record<EstrategiaRecomendada['tipo'], string> = {
  regime: '⚖️',
  credito: '💳',
  precificacao: '📋',
  fluxo_caixa: '💰',
  setor: '🏷️',
}

interface ProjecaoAno {
  ano: number
  cbsIbsBrutoAnual: number
  liquidoAnual: number
  creditosAnual: number
  icmsIssRestanteAnual: number
}

interface DadosAPI {
  resultado: ResultadoAnaliseFaturamento
  projecaoAnos: ProjecaoAno[]
  empresa: { razaoSocial: string; regime: string; setor: string; faturamentoMensal: number }
  creditosMensaisFornecedores: number
  ano: number
}

const fmtPct = (v: number) => `${v.toFixed(1)}%`

export default function EstrategiaClientesPage() {
  const [anoSelecionado, setAnoSelecionado] = useState(2027)
  const [pctB2B, setPctB2B] = useState(60)
  const [pctPublico, setPctPublico] = useState(20)
  const pctB2C = Math.max(0, 100 - pctB2B - pctPublico)

  const [faturamentoMensalManual, setFaturamentoMensalManual] = useState('')
  const [dados, setDados] = useState<DadosAPI | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const buscarDados = useCallback(() => {
    setCarregando(true)
    setErro(null)
    const params = new URLSearchParams({
      ano: String(anoSelecionado),
      pctB2B: String(pctB2B),
      pctPublico: String(pctPublico),
    })
    if (faturamentoMensalManual) {
      params.set('faturamentoMensal', faturamentoMensalManual)
    }
    fetch(`/api/estrategia/clientes?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setErro(d.error); setDados(null) }
        else setDados(d)
      })
      .catch(() => setErro('Erro ao carregar análise.'))
      .finally(() => setCarregando(false))
  }, [anoSelecionado, pctB2B, pctPublico, faturamentoMensalManual])

  useEffect(() => { buscarDados() }, [buscarDados])

  const r = dados?.resultado

  const dadosGrafico = (dados?.projecaoAnos ?? []).map((p) => ({
    ano: p.ano,
    'CBS+IBS bruto': Math.round(p.cbsIbsBrutoAnual / 1000),
    'Créditos compras': Math.round(p.creditosAnual / 1000),
    'ICMS/ISS restante': Math.round((p.icmsIssRestanteAnual ?? 0) / 1000),
    'Saldo total': Math.round(p.liquidoAnual / 1000),
  }))

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Estratégia de Clientes</h1>
        <p className="text-muted-foreground/70 text-xs mt-0.5">
          Impacto da reforma no seu faturamento por tipo de cliente · split payment · mitigação
        </p>
      </div>

      {/* Configuração */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm space-y-5">
        <p className="text-sm font-semibold text-foreground">Configurar perfil de receita</p>

        {/* Faturamento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Faturamento mensal (R$)
            </label>
            <input
              type="number"
              min="0"
              placeholder={dados?.empresa.faturamentoMensal
                ? `${Math.round(dados.empresa.faturamentoMensal).toLocaleString('pt-BR')} (do cadastro)`
                : 'Ex: 100000'}
              value={faturamentoMensalManual}
              onChange={(e) => setFaturamentoMensalManual(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-muted-foreground/60 mt-1">
              Deixe em branco para usar o cadastrado no onboarding
            </p>
          </div>
          {dados?.empresa && (
            <div className="flex items-end gap-2 pb-1">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground/70">Empresa</p>
                <p className="text-sm font-semibold text-foreground truncate max-w-xs">{dados.empresa.razaoSocial}</p>
                <div className="flex gap-2">
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{labelRegime(dados.empresa.regime)}</span>
                  <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">{labelSetor(dados.empresa.setor)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Breakdown de clientes */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Composição da base de clientes
          </p>
          <div className="space-y-3">
            {/* B2B Privado */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-foreground">
                  Clientes privados B2B <span className="text-muted-foreground/60">(empresas)</span>
                </label>
                <span className="text-xs font-bold text-blue-600 num">{pctB2B}%</span>
              </div>
              <input
                type="range" min="0" max={100 - pctPublico} step="5"
                value={pctB2B}
                onChange={(e) => setPctB2B(parseInt(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
            {/* Público */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-foreground">
                  Entes públicos <span className="text-muted-foreground/60">(governo, prefeituras, autarquias)</span>
                </label>
                <span className="text-xs font-bold text-amber-600 num">{pctPublico}%</span>
              </div>
              <input
                type="range" min="0" max={100 - pctB2B} step="5"
                value={pctPublico}
                onChange={(e) => setPctPublico(parseInt(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
            {/* B2C — calculado */}
            <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
              <span className="text-xs font-medium text-foreground">
                Consumidores finais B2C <span className="text-muted-foreground/60">(calculado automaticamente)</span>
              </span>
              <span className="text-xs font-bold text-muted-foreground num">{pctB2C}%</span>
            </div>
          </div>
          {/* Barra visual de composição */}
          <div className="flex rounded-lg overflow-hidden h-3">
            <div className="bg-blue-500 transition-all" style={{ width: `${pctB2B}%` }} title={`B2B ${pctB2B}%`} />
            <div className="bg-amber-500 transition-all" style={{ width: `${pctPublico}%` }} title={`Público ${pctPublico}%`} />
            <div className="bg-muted transition-all" style={{ width: `${pctB2C}%` }} title={`B2C ${pctB2C}%`} />
          </div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-500 inline-block" />B2B Privado</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" />Entes Públicos</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-muted border border-border inline-block" />B2C</span>
          </div>
        </div>

        {/* Seletor de ano */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ano de referência</p>
          <div className="flex gap-1.5 flex-wrap">
            {anos.map((ano) => (
              <button
                key={ano}
                onClick={() => setAnoSelecionado(ano)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  anoSelecionado === ano
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-accent/50'
                }`}
              >
                {ano}
              </button>
            ))}
          </div>
        </div>
      </div>

      {erro && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-800 dark:text-amber-300">
          {erro}
        </div>
      )}

      {carregando && (
        <div className="bg-card rounded-2xl border border-border p-10 text-center text-muted-foreground text-sm">
          Calculando análise...
        </div>
      )}

      {!carregando && r && (
        <>
          {/* KPIs principais */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">CBS+IBS bruto</p>
              <p className="num text-2xl font-bold text-foreground">{formatarMoeda(r.totalImpostoNasVendas)}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">cobrado nas vendas/mês</p>
            </div>
            <div className="bg-card rounded-2xl border border-emerald-200 dark:border-emerald-800/60 p-4 shadow-sm">
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Créditos compras</p>
              <p className="num text-2xl font-bold text-emerald-600">{formatarMoeda(r.creditosFornecedores)}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">de CBS/IBS dos fornecedores</p>
            </div>
            <div className={`bg-card rounded-2xl border p-4 shadow-sm ${r.saldoLiquidoMensal > r.comparacao.sistemaAtual.total ? 'border-red-200 dark:border-red-800/60' : 'border-green-200 dark:border-green-800/60'}`}>
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Carga total</p>
              <p className={`num text-2xl font-bold ${r.saldoLiquidoMensal > r.comparacao.sistemaAtual.total ? 'text-red-600' : 'text-green-600'}`}>
                {formatarMoeda(r.saldoLiquidoMensal)}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                CBS/IBS liq. + {r.icmsIssRestanteMensal > 0 ? 'ICMS/ISS restante' : 'sem tributos antigos'}
              </p>
            </div>
            <div className="bg-card rounded-2xl border border-amber-200 dark:border-amber-800/60 p-4 shadow-sm">
              <p className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2">Split payment</p>
              <p className="num text-2xl font-bold text-amber-600">{formatarMoeda(r.retidoSplitPaymentMensal)}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">retidos automaticamente/mês</p>
            </div>
          </div>

          {/* Comparação sistema atual vs reforma */}
          <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">Sistema atual vs Reforma Tributária — {anoSelecionado}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Sistema atual */}
              <div className="rounded-xl border border-border p-4 space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sistema atual (100%)</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PIS/COFINS</span>
                    <span className="num font-medium">{formatarMoeda(r.comparacao.sistemaAtual.pisCofins)}</span>
                  </div>
                  {r.comparacao.sistemaAtual.icms > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ICMS</span>
                      <span className="num font-medium">{formatarMoeda(r.comparacao.sistemaAtual.icms)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ISS</span>
                    <span className="num font-medium">{formatarMoeda(r.comparacao.sistemaAtual.iss)}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-1.5">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="num font-bold text-foreground">{formatarMoeda(r.comparacao.sistemaAtual.total)}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground/60">Estimativa — verificar com contador</p>
              </div>

              {/* Seta de variação */}
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <p className={`text-2xl font-bold num ${r.comparacao.variacao > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {r.comparacao.variacao > 0 ? '+' : ''}{formatarMoeda(r.comparacao.variacao)}
                  </p>
                  <p className={`text-sm font-semibold ${r.comparacao.variacao > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {r.comparacao.variacaoPercentual > 0 ? '+' : ''}{r.comparacao.variacaoPercentual.toFixed(1)}% /mês
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">vs sistema atual</p>
                </div>
              </div>

              {/* Reforma */}
              <div className={`rounded-xl border p-4 space-y-2 ${r.comparacao.variacao > 0 ? 'border-red-200 bg-red-50/30 dark:bg-red-900/10' : 'border-green-200 bg-green-50/30 dark:bg-green-900/10'}`}>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Reforma ({anoSelecionado})</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CBS bruto</span>
                    <span className="num font-medium">{formatarMoeda(r.cbsBrutoMensal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IBS bruto</span>
                    <span className="num font-medium">{formatarMoeda(r.ibsBrutoMensal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">(-) Créditos</span>
                    <span className="num font-medium text-emerald-600">- {formatarMoeda(r.creditosFornecedores)}</span>
                  </div>
                  {r.pisCofinsRestanteMensal > 0 && (
                    <div className="flex justify-between pt-0.5">
                      <span className="text-amber-700 dark:text-amber-400 text-xs">PIS/COFINS (ainda vigente)</span>
                      <span className="num font-medium text-amber-700 dark:text-amber-400">{formatarMoeda(r.pisCofinsRestanteMensal)}</span>
                    </div>
                  )}
                  {r.icmsIssRestanteMensal > 0 && (
                    <div className="flex justify-between pt-0.5">
                      <span className="text-amber-700 dark:text-amber-400 text-xs">ICMS/ISS ainda vigente</span>
                      <span className="num font-medium text-amber-700 dark:text-amber-400">{formatarMoeda(r.icmsIssRestanteMensal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-border pt-1.5">
                    <span className="font-semibold text-foreground">Carga total</span>
                    <span className="num font-bold text-foreground">{formatarMoeda(r.saldoLiquidoMensal)}</span>
                  </div>
                </div>
                {r.icmsIssRestanteMensal > 0 && (
                  <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
                    ICMS/ISS reduz gradualmente até zerar em 2033
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Análise por tipo de cliente */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border/60 bg-muted/50">
              <h2 className="text-sm font-semibold text-foreground">Análise por tipo de cliente — {anoSelecionado}</h2>
              <p className="text-xs text-muted-foreground/70 mt-0.5">CBS/IBS cobrado, split payment e crédito transferido ao comprador</p>
            </div>
            <div className="divide-y divide-border/60">
              {[
                { key: 'b2bPrivado', label: 'B2B Privado', cor: 'bg-blue-500', desc: 'Empresas privadas' },
                { key: 'publico', label: 'Entes Públicos', cor: 'bg-amber-500', desc: 'Governo, prefeituras, autarquias' },
                { key: 'b2c', label: 'Consumidor Final (B2C)', cor: 'bg-slate-400', desc: 'Pessoas físicas' },
              ].map(({ key, label, cor, desc }) => {
                const t = r.porTipoCliente[key as keyof typeof r.porTipoCliente]
                if (t.faturamentoMensal === 0) return null
                return (
                  <div key={key} className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${cor}`} />
                      <span className="text-sm font-semibold text-foreground">{label}</span>
                      <span className="text-xs text-muted-foreground/60">{desc}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Faturamento</p>
                        <p className="num text-base font-bold text-foreground">{formatarMoeda(t.faturamentoMensal)}</p>
                        <p className="text-xs text-muted-foreground/60">/mês</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">CBS+IBS cobrado</p>
                        <p className="num text-base font-bold text-foreground">{formatarMoeda(t.cbsIbsCobrado)}</p>
                        <p className="text-xs text-muted-foreground/60">/mês</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/15 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Split payment</p>
                        <p className="num text-base font-bold text-amber-600">{formatarMoeda(t.splitPaymentRetido)}</p>
                        <p className="text-xs text-muted-foreground/60">retido automaticamente</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${t.creditoTransferidoAoComprador > 0 ? 'bg-emerald-50 dark:bg-emerald-900/15' : 'bg-muted/50'}`}>
                        <p className="text-xs text-muted-foreground mb-1">Crédito ao comprador</p>
                        {t.creditoTransferidoAoComprador > 0 ? (
                          <>
                            <p className="num text-base font-bold text-emerald-600">{formatarMoeda(t.creditoTransferidoAoComprador)}</p>
                            <p className="text-xs text-emerald-700/70">({fmtPct(t.percentualCredito)} do valor)</p>
                          </>
                        ) : (
                          <>
                            <p className="text-base font-bold text-muted-foreground">—</p>
                            <p className="text-xs text-muted-foreground/60">não gera crédito</p>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-muted/40 border border-border/60 rounded-lg text-xs text-foreground/80 leading-relaxed">
                      {t.observacao}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Gráfico projeção */}
          {dadosGrafico.length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-foreground mb-1">Projeção da carga tributária anual — 2026 a 2033</h2>
              <p className="text-xs text-muted-foreground/70 mb-4">CBS+IBS bruto, ICMS/ISS ainda vigentes, créditos das compras e saldo total (em R$ mil)</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dadosGrafico} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="ano" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => `${v}K`} />
                  <Tooltip formatter={(v) => `R$ ${Number(v).toLocaleString('pt-BR')}K`} contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="CBS+IBS bruto" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="ICMS/ISS restante" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Créditos compras" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Saldo total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Estratégias de mitigação */}
          {r.estrategias.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Estratégias de mitigação</h2>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Ações recomendadas com base no seu perfil</p>
              </div>
              <div className="space-y-3">
                {r.estrategias.map((e, i) => (
                  <div key={i} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{tipoIcon[e.tipo]}</span>
                        <span className="text-sm font-semibold text-foreground">{e.titulo}</span>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${prioridadeBadge[e.prioridade]}`}>
                        {e.prioridade}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/80 leading-relaxed mb-2">{e.descricao}</p>
                    <div className="p-2.5 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground/80">
                        <span className="font-semibold text-foreground/70">Impacto estimado: </span>
                        {e.impactoEstimado}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Split payment — explicação */}
          <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800/60 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">Como funciona o split payment</h3>
            <div className="space-y-2 text-xs text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
              <p>No novo sistema, quando seu cliente pagar a nota fiscal, o banco <strong>retém automaticamente</strong> o CBS e IBS e repassa diretamente ao governo — você nunca tem acesso a esse dinheiro.</p>
              <p>Créditos acumulados (do que você comprou) são <strong>ressarcidos em até 15 dias úteis + 10 dias bancários</strong>. Isso cria um descasamento de caixa que precisa ser planejado.</p>
              <p>Para contratos públicos, o split payment é implementado diretamente no sistema de pagamento do governo — sem possibilidade de negociação de prazo.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
