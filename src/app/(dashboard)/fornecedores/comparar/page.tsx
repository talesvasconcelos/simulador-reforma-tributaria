'use client'

import { useState, useEffect } from 'react'
import { labelRegime, labelSetor } from '@/lib/utils'
import { calcularCustoEfetivo } from '@/lib/simulador/analise-fornecedores'
import type { Fornecedor } from '@/types/empresa'

const ANOS = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

const fmtMoeda = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtPct = (v: number) => `${v.toFixed(2)}%`

const corRecomendacao = {
  manter: 'bg-green-100 text-green-700 border-green-200',
  renegociar: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  avaliar_substituto: 'bg-red-100 text-red-700 border-red-200',
}

const labelRecomendacao = {
  manter: '✓ Manter',
  renegociar: '⚠ Renegociar',
  avaliar_substituto: '✗ Avaliar substituto',
}

interface ItemComparacao {
  fornecedor: Fornecedor
  preco: string
}

export default function CompararFornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [empresa, setEmpresa] = useState<{ regime: string; setor: string } | null>(null)
  const [ano, setAno] = useState(2027)
  const [selecionados, setSelecionados] = useState<ItemComparacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    const fetchJson = (url: string) =>
      fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null)

    Promise.all([fetchJson('/api/fornecedores'), fetchJson('/api/empresa')]).then(([f, e]) => {
      setFornecedores(((f?.fornecedores ?? []) as Fornecedor[]).filter((x) => x.statusEnriquecimento === 'concluido'))
      if (e?.regime) setEmpresa(e)
      setCarregando(false)
    })
  }, [])

  function toggleFornecedor(f: Fornecedor) {
    setSelecionados((prev) => {
      const existe = prev.find((s) => s.fornecedor.id === f.id)
      if (existe) return prev.filter((s) => s.fornecedor.id !== f.id)
      if (prev.length >= 5) return prev // máx 5
      return [...prev, { fornecedor: f, preco: f.precoReferencia ?? f.valorMedioComprasMensal ?? '' }]
    })
  }

  function setPreco(id: string, valor: string) {
    setSelecionados((prev) =>
      prev.map((s) => (s.fornecedor.id === id ? { ...s, preco: valor } : s))
    )
  }

  const resultados = selecionados
    .filter((s) => parseFloat(s.preco) > 0)
    .map((s) => {
      const analise = calcularCustoEfetivo({
        fornecedorId: s.fornecedor.id,
        cnpj: s.fornecedor.cnpj,
        nome: s.fornecedor.razaoSocial ?? s.fornecedor.nomeErp ?? s.fornecedor.cnpj,
        regime: s.fornecedor.regime ?? 'nao_identificado',
        setor: s.fornecedor.setor ?? 'misto',
        precoMedioMensal: parseFloat(s.preco),
        setorComprador: empresa?.setor ?? 'misto',
        regimeComprador: empresa?.regime ?? 'lucro_presumido',
        ano,
        opcaoCbsIbsPorFora: s.fornecedor.opcaoCbsIbsPorFora ?? false,
      })
      return { item: s, analise }
    })
    .sort((a, b) => a.analise.custoEfetivo - b.analise.custoEfetivo)

  const melhor = resultados[0]?.analise.custoEfetivo

  if (carregando) return <div className="p-8 text-muted-foreground">Carregando...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comparar Fornecedores</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Selecione até 5 fornecedores e informe o preço para ver o custo efetivo após créditos CBS+IBS
          </p>
        </div>
        <select
          value={ano}
          onChange={(e) => setAno(Number(e.target.value))}
          className="px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {ANOS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seleção de fornecedores */}
        <div className="bg-card rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border/60">
            <h2 className="text-sm font-semibold text-foreground/80">
              1. Selecione os fornecedores ({selecionados.length}/5)
            </h2>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Apenas fornecedores com enriquecimento concluído</p>
            <input
              type="text"
              placeholder="Filtrar por nome ou CNPJ..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="mt-2 w-full border border-border rounded-lg px-3 py-1.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
          </div>
          <div className="divide-y divide-border/60 max-h-96 overflow-y-auto">
            {fornecedores.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground/70">Nenhum fornecedor enriquecido ainda.</p>
            ) : (
              fornecedores.filter((f) => {
                if (!busca.trim()) return true
                const termo = busca.toLowerCase()
                return (
                  f.razaoSocial?.toLowerCase().includes(termo) ||
                  f.nomeErp?.toLowerCase().includes(termo) ||
                  f.cnpj.includes(busca.replace(/\D/g, ''))
                )
              }).map((f) => {
                const selecionado = selecionados.some((s) => s.fornecedor.id === f.id)
                return (
                  <label
                    key={f.id}
                    className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors ${
                      selecionado ? 'bg-blue-50' : 'hover:bg-accent/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selecionado}
                      onChange={() => toggleFornecedor(f)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {f.razaoSocial ?? f.nomeErp ?? f.cnpj}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {labelRegime(f.regime ?? '')} · {labelSetor(f.setor ?? '')}
                        {f.opcaoCbsIbsPorFora && (
                          <span className="ml-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                            CBS/IBS por fora
                          </span>
                        )}
                      </p>
                    </div>
                  </label>
                )
              })
            )}
          </div>
        </div>

        {/* Preços */}
        <div className="bg-card rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border/60">
            <h2 className="text-sm font-semibold text-foreground/80">2. Informe o preço por fornecedor (R$)</h2>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Valor mensal ou unitário — use a mesma base para todos</p>
          </div>
          <div className="divide-y divide-border/60">
            {selecionados.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground/70">Selecione fornecedores ao lado.</p>
            ) : (
              selecionados.map((s) => (
                <div key={s.fornecedor.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {s.fornecedor.razaoSocial ?? s.fornecedor.nomeErp ?? s.fornecedor.cnpj}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={s.preco}
                      onChange={(e) => setPreco(s.fornecedor.id, e.target.value)}
                      className="w-32 px-2 py-1.5 border border-border rounded-lg text-sm text-right bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Resultado da comparação */}
      {resultados.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h2 className="text-sm font-semibold text-foreground/80">
              Resultado — {ano} · menor custo efetivo primeiro
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fornecedor</th>
                  <th className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Regime</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Preço bruto</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">% Crédito</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Crédito R$</th>
                  <th className="text-right px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted">Custo efetivo</th>
                  <th className="text-center px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {resultados.map(({ item, analise }, idx) => {
                  const economia = analise.custoEfetivo - melhor
                  const isMelhor = idx === 0
                  return (
                    <tr key={item.fornecedor.id} className={isMelhor ? 'bg-green-50' : ''}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {isMelhor && (
                            <span className="text-xs font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">
                              MELHOR
                            </span>
                          )}
                          <div>
                            <p className="font-medium text-foreground">
                              {item.fornecedor.razaoSocial ?? item.fornecedor.nomeErp ?? item.fornecedor.cnpj}
                            </p>
                            <p className="text-xs text-muted-foreground">{labelSetor(item.fornecedor.setor ?? '')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground/80">
                          {labelRegime(analise.regime)}
                        </span>
                        {item.fornecedor.opcaoCbsIbsPorFora && (
                          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            CBS/IBS por fora
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right num font-mono text-foreground/80">
                        {fmtMoeda(analise.precoMedioMensal)}
                      </td>
                      <td className="px-5 py-4 text-right num text-green-600 font-medium">
                        {fmtPct(analise.percentualCredito)}
                      </td>
                      <td className="px-5 py-4 text-right num text-green-600 font-medium">
                        {fmtMoeda(analise.creditoMensal)}
                      </td>
                      <td className="px-5 py-4 text-right num font-bold text-foreground bg-muted/50">
                        {fmtMoeda(analise.custoEfetivo)}
                        {!isMelhor && economia > 0 && (
                          <p className="text-xs text-red-500 font-normal">
                            +{fmtMoeda(economia)} vs. melhor
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${
                          corRecomendacao[analise.recomendacao]
                        }`}>
                          {labelRecomendacao[analise.recomendacao]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Nota explicativa */}
          <div className="px-5 py-3 bg-muted/50 border-t border-border text-xs text-muted-foreground">
            Crédito calculado sobre CBS+IBS vigente em {ano} conforme LC 214/2025.
            Simples sem opção por fora: crédito presumido de 1,5%.
            Simples com opção CBS/IBS por fora: crédito integral igual ao Lucro Real/Presumido.
          </div>
        </div>
      )}
    </div>
  )
}
