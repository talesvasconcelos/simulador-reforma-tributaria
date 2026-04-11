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
  const [analisesPorSetor, setAnalisesPorSetor] = useState<Array<{
    setor: string
    label: string
    qtdFornecedores: number
    totalComprasMensal: number
    totalCreditoMensal: number
    percentualCreditoMedio: number
    totalComprasAnual: number
    totalCreditoAnual: number
    creditoPerdidoAnual: number
  }>>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [analisesPorCategoria, setAnalisesPorCategoria] = useState<Array<{
    categoria: string
    qtdFornecedores: number
    totalComprasMensal: number
    totalCreditoMensal: number
    totalComprasAnual: number
    totalCreditoAnual: number
    creditoPerdidoAnual: number
    percentualCreditoMedio: number
  }>>([])
  const [mostrarCategoria, setMostrarCategoria] = useState(false)

  useEffect(() => {
    setCarregando(true)
    fetch(`/api/estrategia?ano=${anoSelecionado}`)
      .then((r) => r.json())
      .then((d) => {
        setAnalises(d.analises ?? [])
        setResumo(d.resumo)
        setEconomiaAnual(d.economiaAnual ?? {})
        setAnalisesPorSetor(d.analisesPorSetor ?? [])
        setAnalisesPorCategoria(d.analisesPorCategoria ?? [])
        const temCategoria = (d.analisesPorCategoria ?? []).some(
          (c: { categoria: string }) => c.categoria !== '(sem categoria)'
        )
        setMostrarCategoria(temCategoria)
        setCarregando(false)
      })
  }, [anoSelecionado])

  const dadosEconomia = Object.entries(economiaAnual).map(([ano, valor]) => ({
    ano: parseInt(ano),
    'Crédito Estimado': Math.round(valor),
  }))

  const buscaNorm = busca.trim().toLowerCase().replace(/\D/g, '') || busca.trim().toLowerCase()
  const analisesFiltradas = analises.filter((a) => {
    if (busca.trim()) {
      const cnpjLimpo = a.cnpj.replace(/\D/g, '')
      const matchBusca =
        a.nome.toLowerCase().includes(busca.trim().toLowerCase()) ||
        cnpjLimpo.includes(buscaNorm)
      if (!matchBusca) return false
    }
    if (categoriaFiltro) {
      const cat = a.categoriaCompra ?? '(sem categoria)'
      if (cat !== categoriaFiltro) return false
    }
    return true
  })

  const categoriasDisponiveis = Array.from(
    new Set(analises.map((a) => a.categoriaCompra ?? '(sem categoria)'))
  ).sort()

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

      {/* Dashboard de crédito por tipo de atividade */}
      {analisesPorSetor.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 bg-muted/50">
            <h2 className="font-semibold text-foreground/80 text-sm">Crédito Obtido por Tipo de Atividade — {anoSelecionado}</h2>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Do menor para o maior percentual de crédito CBS+IBS — identifique as atividades com menor aproveitamento
            </p>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={Math.max(180, analisesPorSetor.length * 36)}>
              <BarChart
                data={analisesPorSetor.map((s) => ({
                  label: s.label,
                  '% Crédito': parseFloat(s.percentualCreditoMedio.toFixed(2)),
                  qtd: s.qtdFornecedores,
                }))}
                layout="vertical"
                barCategoryGap="25%"
                margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 'dataMax']}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  width={180}
                />
                <Tooltip
                  formatter={(v, _name, props) => [
                    `${Number(v).toFixed(2)}% (${props.payload?.qtd} fornecedor${props.payload?.qtd !== 1 ? 'es' : ''})`,
                    '% Crédito médio'
                  ]}
                  contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="% Crédito" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Tabela detalhe por setor */}
          <div className="border-t border-border/60 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Atividade</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fornecedores</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Compras/ano</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Crédito/ano</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">% Crédito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {analisesPorSetor.map((s) => (
                  <tr key={s.setor} className="hover:bg-accent/30 transition-colors">
                    <td className="px-5 py-3 font-medium text-foreground">{s.label}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground num">{s.qtdFornecedores}</td>
                    <td className="px-5 py-3 text-right text-foreground num">{formatarMoeda(s.totalComprasAnual)}</td>
                    <td className="px-5 py-3 text-right text-green-600 font-semibold num">{formatarMoeda(s.totalCreditoAnual)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        s.percentualCreditoMedio < 2
                          ? 'bg-red-100 text-red-700'
                          : s.percentualCreditoMedio < 10
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                      }`}>
                        {s.percentualCreditoMedio.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Breakdown por plano de contas — visível somente se há categorias cadastradas */}
      {mostrarCategoria && analisesPorCategoria.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 bg-muted/50">
            <h2 className="font-semibold text-foreground/80 text-sm">Impacto por Plano de Contas — {anoSelecionado}</h2>
            <p className="text-xs text-muted-foreground/70 mt-0.5">
              Compras e crédito CBS+IBS agrupados pela categoria de gasto do seu ERP
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Categoria</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fornecedores</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Compras/ano</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Crédito/ano</th>
                  <th className="text-right px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">% Crédito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {analisesPorCategoria.map((c) => (
                  <tr
                    key={c.categoria}
                    className={`hover:bg-accent/30 transition-colors cursor-pointer ${categoriaFiltro === c.categoria ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}
                    onClick={() => setCategoriaFiltro(categoriaFiltro === c.categoria ? '' : c.categoria)}
                    title="Clique para filtrar o ranking por esta categoria"
                  >
                    <td className="px-5 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {categoriaFiltro === c.categoria && (
                          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                        )}
                        {c.categoria}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground num">{c.qtdFornecedores}</td>
                    <td className="px-5 py-3 text-right text-foreground num">{formatarMoeda(c.totalComprasAnual)}</td>
                    <td className="px-5 py-3 text-right text-green-600 font-semibold num">{formatarMoeda(c.totalCreditoAnual)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        c.percentualCreditoMedio < 2
                          ? 'bg-red-100 text-red-700'
                          : c.percentualCreditoMedio < 10
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-green-100 text-green-700'
                      }`}>
                        {c.percentualCreditoMedio.toFixed(2)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {categoriaFiltro && (
            <div className="px-5 py-2.5 border-t border-border/60 bg-violet-50 dark:bg-violet-900/20 flex items-center justify-between text-xs">
              <span className="text-violet-700 dark:text-violet-300 font-medium">
                Filtrando ranking por: <strong>{categoriaFiltro}</strong>
              </span>
              <button onClick={() => setCategoriaFiltro('')} className="text-violet-500 hover:text-violet-700 underline">
                Limpar filtro
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabela de fornecedores */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 bg-muted/50 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h2 className="font-semibold text-foreground/80 text-sm">
              Ranking por Custo Efetivo — {anoSelecionado}
              {categoriaFiltro && <span className="ml-2 text-violet-600 font-normal text-xs">· {categoriaFiltro}</span>}
            </h2>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Ordenado do mais vantajoso ao mais oneroso</p>
          </div>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou CNPJ…"
            className="w-full sm:w-64 text-sm px-3 py-1.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
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
                {mostrarCategoria && (
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Categoria</th>
                )}
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Preço/mês</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Crédito</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Custo efetivo</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {analisesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={mostrarCategoria ? 7 : 6} className="p-8 text-center text-muted-foreground text-sm">
                    Nenhum fornecedor encontrado para &ldquo;{busca || categoriaFiltro}&rdquo;.
                  </td>
                </tr>
              ) : analisesFiltradas.map((a) => (
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
                  {mostrarCategoria && (
                    <td className="px-4 py-3">
                      {a.categoriaCompra ? (
                        <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded">
                          {a.categoriaCompra}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                  )}
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
