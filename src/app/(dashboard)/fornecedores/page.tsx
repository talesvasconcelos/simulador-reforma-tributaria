'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { formatarCnpj, formatarMoeda, labelRegime, labelSetor } from '@/lib/utils'
import type { Fornecedor } from '@/types/empresa'

const badgeStatus = {
  pendente: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  em_processamento: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  concluido: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  erro: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  nao_encontrado: 'bg-muted text-muted-foreground',
}

const labelStatus = {
  pendente: 'Pendente',
  em_processamento: 'Processando',
  concluido: 'Concluído',
  erro: 'Erro',
  nao_encontrado: 'Não encontrado',
}

interface ResultadoCnpj {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  cnae_fiscal_descricao: string
  uf: string
  municipio: string
  porte: string
  opcao_pelo_simples: boolean
  opcao_pelo_mei: boolean
  situacao_cadastral: number
  descricao_situacao_cadastral: string
}

// ── Evolução de crédito por ano da transição ──────────────────────────────────
const ANOS_REFORMA = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033]

// IBS progressivo: 0% em 2026-2028, 10%→40% em 2029-2032, 100% em 2033
const IBS_POR_ANO: Record<number, number> = {
  2026: 0, 2027: 0, 2028: 0,
  2029: 17.7 * 0.10, 2030: 17.7 * 0.20,
  2031: 17.7 * 0.30, 2032: 17.7 * 0.40,
  2033: 17.7,
}

interface CreditoAno { cbs: number; ibs: number; total: number; creditoMensal: number | null }

function calcularCreditoNoAno(f: Fornecedor, ano: number): CreditoAno {
  if (ano === 2026) return { cbs: 0, ibs: 0, total: 0, creditoMensal: 0 }

  const reducer = parseFloat(f.reducaoAliquota ?? '0') / 100
  const fator = 1 - reducer
  const cbsBase = 8.8 * fator
  const ibsBase = (IBS_POR_ANO[ano] ?? 0) * fator
  const preco = parseFloat(f.precoReferencia ?? f.valorMedioComprasMensal ?? '0') || null

  const porFora = f.opcaoCbsIbsPorFora ?? false
  const ehLucro = f.regime === 'lucro_real' || f.regime === 'lucro_presumido'
  const ehSimples = f.regime === 'simples_nacional'
  const ehMei = f.regime === 'mei'

  if (ehLucro || ((ehSimples || ehMei) && porFora)) {
    const total = cbsBase + ibsBase
    return { cbs: cbsBase, ibs: ibsBase, total, creditoMensal: preco ? preco * total / 100 : null }
  }
  if (ehSimples) {
    return { cbs: 0, ibs: 0, total: 1.5, creditoMensal: preco ? preco * 0.015 : null }
  }
  if (ehMei) {
    return { cbs: 0, ibs: 0, total: 0.5, creditoMensal: preco ? preco * 0.005 : null }
  }
  return { cbs: 0, ibs: 0, total: 0, creditoMensal: 0 }
}

// ── Painel de evolução de crédito por ano ─────────────────────────────────────
interface PainelEvolucaoProps {
  f: Fornecedor
  anos: number[]
  onChangeAnos: (anos: number[]) => void
}

function PainelEvolucao({ f, anos, onChangeAnos }: PainelEvolucaoProps) {
  const ehSimples = f.regime === 'simples_nacional'
  const ehMei = f.regime === 'mei'
  const ehPresumido = ehSimples || ehMei
  const temPreco = !!parseFloat(f.precoReferencia ?? f.valorMedioComprasMensal ?? '0')

  function toggleAno(ano: number) {
    if (anos.includes(ano)) {
      if (anos.length === 1) return // manter ao menos 1
      onChangeAnos(anos.filter((a) => a !== ano))
    } else {
      onChangeAnos([...ANOS_REFORMA].filter((a) => anos.includes(a) || a === ano))
    }
  }

  function toggleTodos() {
    if (anos.length === ANOS_REFORMA.length) {
      onChangeAnos([ANOS_REFORMA[1]]) // deixa pelo menos 2027 selecionado
    } else {
      onChangeAnos(ANOS_REFORMA)
    }
  }

  const todosSelecionados = anos.length === ANOS_REFORMA.length

  return (
    <div className="space-y-3">
      {/* Seletor de anos */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mr-1">Anos:</span>
        {ANOS_REFORMA.map((ano) => (
          <button
            key={ano}
            onClick={() => toggleAno(ano)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              anos.includes(ano)
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-accent/60'
            }`}
          >
            {ano}
          </button>
        ))}
        <button
          onClick={toggleTodos}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors ml-1"
        >
          {todosSelecionados ? 'Desmarcar todos' : 'Todos'}
        </button>
      </div>

      {/* Tabela de evolução */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[420px]">
          <thead>
            <tr className="border-b border-indigo-100 dark:border-indigo-900/40">
              <th className="text-left py-1.5 pr-4 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">Ano</th>
              {!ehPresumido && (
                <>
                  <th className="text-right py-1.5 px-3 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">CBS%</th>
                  <th className="text-right py-1.5 px-3 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">IBS%</th>
                </>
              )}
              <th className="text-right py-1.5 px-3 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">Total%</th>
              {temPreco && (
                <th className="text-right py-1.5 pl-3 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">Créd./mês</th>
              )}
              {ehPresumido && (
                <th className="text-left py-1.5 pl-3 font-semibold text-muted-foreground/70 uppercase tracking-wider text-[10px]">Tipo</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
            {anos.map((ano) => {
              const c = calcularCreditoNoAno(f, ano)
              const semCredito = c.total === 0
              return (
                <tr key={ano} className={semCredito ? 'opacity-50' : ''}>
                  <td className="py-1.5 pr-4 font-semibold text-foreground num">{ano}</td>
                  {!ehPresumido && (
                    <>
                      <td className="py-1.5 px-3 text-right text-muted-foreground num">
                        {semCredito ? '—' : `${c.cbs.toFixed(2)}%`}
                      </td>
                      <td className="py-1.5 px-3 text-right text-muted-foreground num">
                        {semCredito ? '—' : c.ibs > 0 ? `${c.ibs.toFixed(2)}%` : '—'}
                      </td>
                    </>
                  )}
                  <td className="py-1.5 px-3 text-right font-semibold num">
                    {semCredito ? (
                      <span className="text-muted-foreground/50">—</span>
                    ) : (
                      <span className="text-green-600">{c.total.toFixed(2)}%</span>
                    )}
                  </td>
                  {temPreco && (
                    <td className="py-1.5 pl-3 text-right font-semibold num">
                      {semCredito || c.creditoMensal === null ? (
                        <span className="text-muted-foreground/50">—</span>
                      ) : (
                        <span className="text-green-600">{formatarMoeda(c.creditoMensal)}</span>
                      )}
                    </td>
                  )}
                  {ehPresumido && (
                    <td className="py-1.5 pl-3 text-muted-foreground/60 italic text-[10px]">
                      {semCredito ? '—' : 'crédito presumido'}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!temPreco && (
        <p className="text-[11px] text-muted-foreground/60 italic">
          Cadastre um preço de referência para ver o crédito mensal estimado.
        </p>
      )}
    </div>
  )
}

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [carregando, setCarregando] = useState(true)
  const [progresso, setProgresso] = useState({
    total: 0, pendente: 0, emProcessamento: 0, concluido: 0, erro: 0, naoEncontrado: 0, percentualConcluido: 0,
  })

  const [cnpjInput, setCnpjInput] = useState('')
  const [consultando, setConsultando] = useState(false)
  const [resultadoCnpj, setResultadoCnpj] = useState<ResultadoCnpj | null>(null)
  const [erroCnpj, setErroCnpj] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  const [adicionado, setAdicionado] = useState(false)
  const [enriquecendo, setEnriquecendo] = useState(false)
  const [enriquecendoId, setEnriquecendoId] = useState<string | null>(null)
  const [enriquecendoTodos, setEnriquecendoTodos] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editPreco, setEditPreco] = useState('')
  const [editCbsPorFora, setEditCbsPorFora] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [confirmandoExclusaoId, setConfirmandoExclusaoId] = useState<string | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [erroDetalhes, setErroDetalhes] = useState<string | null>(null)
  const [mostrandoErroId, setMostrandoErroId] = useState<string | null>(null)
  const [evolucaoAbertaId, setEvolucaoAbertaId] = useState<string | null>(null)
  const [anosEvolucao, setAnosEvolucao] = useState<number[]>(ANOS_REFORMA)
  const [anosTabela, setAnosTabela] = useState<number[]>([])
  const [pagina, setPagina] = useState(1)
  const [totalFornecedores, setTotalFornecedores] = useState(0)
  const [buscaInput, setBuscaInput] = useState('')
  const [busca, setBusca] = useState('')
  const POR_PAGINA = 50
  const inputRef = useRef<HTMLInputElement>(null)

  function toggleAnoTabela(ano: number) {
    setAnosTabela(prev => prev.includes(ano) ? prev.filter(a => a !== ano) : [...prev, ano].sort((a, b) => a - b))
  }

  function exportarCsv() {
    const cabecalho = [
      'CNPJ', 'Razão Social', 'Nome Fantasia', 'Regime', 'Setor', 'CNAE Código', 'CNAE Descrição',
      'UF', 'Município', 'Porte', 'Situação Cadastral', 'Gera Crédito', '% Crédito (Geral)',
      'Redução Alíquota %', 'Setor Diferenciado', 'Sujeito IS', 'Preço Referência (R$)',
      'Valor Médio Mensal (R$)', 'CBS/IBS por Fora', 'Status Enriquecimento',
      ...ANOS_REFORMA.map(a => `% Crédito ${a}`),
      ...ANOS_REFORMA.map(a => `Crédito Mensal ${a} (R$)`),
    ]
    const linhas = fornecedores.map(f => {
      const pcts = ANOS_REFORMA.map(ano => calcularCreditoNoAno(f, ano).total.toFixed(2))
      const vals = ANOS_REFORMA.map(ano => {
        const c = calcularCreditoNoAno(f, ano)
        return c.creditoMensal !== null ? c.creditoMensal.toFixed(2) : ''
      })
      return [
        f.cnpj, f.razaoSocial ?? '', f.nomeFantasia ?? '',
        labelRegime(f.regime ?? ''), labelSetor(f.setor ?? ''),
        f.cnaeCodigoPrincipal ?? '', f.cnaeDescricaoPrincipal ?? '',
        f.uf ?? '', f.municipio ?? '', f.porte ?? '', f.situacaoCadastral ?? '',
        f.geraCredito ? 'Sim' : 'Não',
        f.percentualCreditoEstimado ?? '', f.reducaoAliquota ?? '0',
        f.setorDiferenciadoReforma ? 'Sim' : 'Não',
        f.sujetoImpSeletivo ? 'Sim' : 'Não',
        f.precoReferencia ?? '', f.valorMedioComprasMensal ?? '',
        f.opcaoCbsIbsPorFora ? 'Sim' : 'Não',
        f.statusEnriquecimento,
        ...pcts, ...vals,
      ]
    })
    const csv = [cabecalho, ...linhas]
      .map(linha => linha.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fornecedores_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function carregarFornecedores(pag = pagina, filtro = busca) {
    const params = new URLSearchParams({ pagina: String(pag), porPagina: String(POR_PAGINA) })
    if (filtro) params.set('busca', filtro)
    const d = await fetch(`/api/fornecedores?${params}`).then((r) => r.json())
    setFornecedores(d.fornecedores ?? [])
    setTotalFornecedores(d.total ?? 0)
  }

  // Debounce da busca: 350ms após parar de digitar
  useEffect(() => {
    const t = setTimeout(() => setBusca(buscaInput), 350)
    return () => clearTimeout(t)
  }, [buscaInput])

  // Ao mudar busca: volta pra pág 1 e recarrega
  useEffect(() => {
    setPagina(1)
    carregarFornecedores(1, busca).then(() => setCarregando(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca])

  useEffect(() => {
    if (busca) return // busca já cuida
    carregarFornecedores(pagina).then(() => setCarregando(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina])

  useEffect(() => {
    const eventSource = new EventSource('/api/fornecedores/progresso')
    eventSource.onmessage = (e) => {
      const dados = JSON.parse(e.data)
      setProgresso(dados)
    }
    return () => eventSource.close()
  }, [])

  function aplicarMascaraCnpj(valor: string) {
    const digits = valor.replace(/\D/g, '').slice(0, 14)
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }

  async function consultarCnpj() {
    const cnpj = cnpjInput.replace(/\D/g, '')
    if (cnpj.length !== 14) {
      setErroCnpj('Informe um CNPJ completo (14 dígitos)')
      return
    }
    setConsultando(true)
    setResultadoCnpj(null)
    setErroCnpj(null)
    setAdicionado(false)
    try {
      const res = await fetch(`/api/fornecedores/consultar?cnpj=${cnpj}`)
      const dados = await res.json()
      if (!res.ok) setErroCnpj(dados.error ?? 'Erro ao consultar CNPJ')
      else setResultadoCnpj(dados)
    } catch {
      setErroCnpj('Erro de conexão. Tente novamente.')
    } finally {
      setConsultando(false)
    }
  }

  async function rodarEnriquecimento(fornecedorId: string, origem: 'consulta' | 'tabela' = 'consulta') {
    if (origem === 'tabela') setEnriquecendoId(fornecedorId)
    else setEnriquecendo(true)
    try {
      const res = await fetch('/api/fornecedores/enriquecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornecedorId }),
      })
      if (!res.ok) {
        const err = await res.json()
        console.error('Erro no enriquecimento:', err)
      }
    } finally {
      if (origem === 'tabela') setEnriquecendoId(null)
      else setEnriquecendo(false)
      await carregarFornecedores()
    }
  }

  async function enriquecerTodos() {
    // Enfileira todos os pendentes/erro para o cron processar (15/min)
    // Não processa aqui — evita timeout de 60s e pico de CPU com grandes volumes
    setEnriquecendoTodos(true)
    try {
      await fetch('/api/fornecedores/enriquecer-lote', { method: 'POST', body: JSON.stringify({}) })
    } catch { /* ignora */ }
    setEnriquecendoTodos(false)
    await carregarFornecedores()
  }

  async function adicionarFornecedor() {
    if (!resultadoCnpj) return
    setAdicionando(true)
    setErroCnpj(null)
    try {
      const res = await fetch('/api/fornecedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj: resultadoCnpj.cnpj.replace(/\D/g, '') }),
      })
      if (!res.ok) {
        const err = await res.json()
        setErroCnpj(err.error ?? 'Erro ao adicionar fornecedor')
        return
      }
      const fornecedor = await res.json()
      setAdicionado(true)
      setAdicionando(false)
      await carregarFornecedores()
      if (fornecedor?.id) await rodarEnriquecimento(fornecedor.id, 'consulta')
    } catch {
      setErroCnpj('Erro ao processar. Tente novamente.')
    } finally {
      setAdicionando(false)
    }
  }

  function abrirEdicao(f: Fornecedor) {
    setEditandoId(f.id)
    setEditPreco(f.precoReferencia ?? f.valorMedioComprasMensal ?? '')
    setEditCbsPorFora(f.opcaoCbsIbsPorFora ?? false)
  }

  async function salvarEdicao(id: string) {
    setSalvando(true)
    try {
      await fetch(`/api/fornecedores/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precoReferencia: parseFloat(editPreco) || undefined,
          opcaoCbsIbsPorFora: editCbsPorFora,
        }),
      })
      await carregarFornecedores()
      setEditandoId(null)
    } finally {
      setSalvando(false)
    }
  }

  async function excluirFornecedor(id: string) {
    setExcluindo(true)
    try {
      await fetch(`/api/fornecedores/${id}`, { method: 'DELETE' })
      setConfirmandoExclusaoId(null)
      await carregarFornecedores()
    } finally {
      setExcluindo(false)
    }
  }

  function limparConsulta() {
    setCnpjInput('')
    setResultadoCnpj(null)
    setErroCnpj(null)
    setAdicionado(false)
    inputRef.current?.focus()
  }

  // Usa contagem do servidor (SSE) — sempre reflete o total real, não só os da tela
  // Inclui nao_encontrado pois pode ter sido causado por rate limit da API (não CNPJ inexistente)
  const pendentesOuErro = (progresso.pendente ?? 0) + (progresso.erro ?? 0) + (progresso.naoEncontrado ?? 0)

  const inputCls = 'border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Fornecedores</h1>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Gestão e enriquecimento de CNPJs</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pendentesOuErro > 0 && !enriquecendoTodos && (
            <button
              onClick={enriquecerTodos}
              className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors shadow-sm"
              title="Reprocessa pendentes, com erro e não encontrados (pode ter sido rate limit da API)"
            >
              Enriquecer todos ({pendentesOuErro})
            </button>
          )}
          {enriquecendoTodos && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400 font-medium">
              <span className="animate-spin inline-block w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full" />
              Enfileirando para processamento...
            </div>
          )}
          {fornecedores.length > 0 && (
            <button
              onClick={exportarCsv}
              className="px-4 py-2 bg-card border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-accent/60 transition-colors"
            >
              Exportar CSV
            </button>
          )}
          <Link
            href="/fornecedores/comparar"
            className="px-4 py-2 bg-card border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-accent/60 transition-colors"
          >
            Comparar
          </Link>
          <Link
            href="/fornecedores/importar"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
          >
            Importar planilha
          </Link>
        </div>
      </div>

      {/* Consulta avulsa */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 bg-muted/50">
          <h2 className="text-sm font-semibold text-foreground/80">Consultar CNPJ avulso</h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Busca em tempo real via BrasilAPI</p>
        </div>
        <div className="p-5">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              placeholder="00.000.000/0000-00"
              value={cnpjInput}
              onChange={(e) => {
                setCnpjInput(aplicarMascaraCnpj(e.target.value))
                setResultadoCnpj(null)
                setErroCnpj(null)
                setAdicionado(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && consultarCnpj()}
              className={`flex-1 max-w-xs font-mono ${inputCls}`}
            />
            <button
              onClick={consultarCnpj}
              disabled={consultando || cnpjInput.replace(/\D/g, '').length !== 14}
              suppressHydrationWarning
              className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 transition-colors"
            >
              {consultando ? 'Consultando...' : 'Consultar'}
            </button>
            {(resultadoCnpj || erroCnpj) && (
              <button
                onClick={limparConsulta}
                className="px-3 py-2 text-sm text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                Limpar
              </button>
            )}
          </div>

          {erroCnpj && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {erroCnpj}
            </div>
          )}

          {resultadoCnpj && (
            <div className="mt-3 p-4 bg-muted/40 border border-border rounded-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <p className="font-semibold text-foreground">{resultadoCnpj.razao_social}</p>
                  {resultadoCnpj.nome_fantasia && (
                    <p className="text-sm text-muted-foreground/70">{resultadoCnpj.nome_fantasia}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
                    <span>
                      <span className="text-muted-foreground/50">CNPJ:</span>{' '}
                      <span className="font-mono num">{formatarCnpj(resultadoCnpj.cnpj.replace(/\D/g, ''))}</span>
                    </span>
                    <span><span className="text-muted-foreground/50">Porte:</span> {resultadoCnpj.porte}</span>
                    <span><span className="text-muted-foreground/50">UF:</span> {resultadoCnpj.uf}</span>
                    <span><span className="text-muted-foreground/50">Município:</span> {resultadoCnpj.municipio}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <span className="text-muted-foreground/50">CNAE:</span> {resultadoCnpj.cnae_fiscal_descricao}
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {resultadoCnpj.opcao_pelo_mei && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                        Simples - MEI
                      </span>
                    )}
                    {resultadoCnpj.opcao_pelo_simples && !resultadoCnpj.opcao_pelo_mei && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Simples Nacional</span>
                    )}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      resultadoCnpj.situacao_cadastral === 2
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {resultadoCnpj.descricao_situacao_cadastral}
                    </span>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {enriquecendo ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-400 font-medium">
                      <span className="animate-spin inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full" />
                      Analisando com IA...
                    </div>
                  ) : adicionado ? (
                    <div className="flex items-center gap-1.5 px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400 font-medium">
                      ✓ Enriquecido com sucesso
                    </div>
                  ) : (
                    <button
                      onClick={adicionarFornecedor}
                      disabled={adicionando}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    >
                      {adicionando ? 'Adicionando...' : 'Adicionar fornecedor'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra de progresso */}
      {progresso.total > 0 && (
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground/80">
              Enriquecimento: <span className="num">{progresso.concluido + progresso.naoEncontrado}/{progresso.total}</span> CNPJs processados
            </p>
            <p className="text-sm font-semibold text-blue-600 num">{progresso.percentualConcluido}%</p>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progresso.percentualConcluido}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground/70">
            <span>Pendente: <span className="num">{progresso.pendente}</span></span>
            <span>Processando: <span className="num">{progresso.emProcessamento}</span></span>
            <span className="text-green-600">Concluído: <span className="num">{progresso.concluido}</span></span>
            {progresso.naoEncontrado > 0 && (
              <span className="text-muted-foreground">Não encontrado: <span className="num">{progresso.naoEncontrado}</span></span>
            )}
            {progresso.erro > 0 && (
              <span className="text-red-600">Erro: <span className="num">{progresso.erro}</span></span>
            )}
          </div>
        </div>
      )}

      {/* Lista de fornecedores */}
      <div className="bg-card rounded-2xl border border-border shadow-sm">
        {/* Campo de busca */}
        <div className="px-4 py-3 border-b border-border/60">
          <input
            type="text"
            placeholder="Buscar por nome ou CNPJ..."
            value={buscaInput}
            onChange={(e) => setBuscaInput(e.target.value)}
            className="w-full max-w-sm border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
          />
        </div>
        {carregando ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : fornecedores.length === 0 ? (
          <div className="p-14 text-center">
            {busca ? (
              <p className="text-muted-foreground text-sm">Nenhum fornecedor encontrado para <strong>&quot;{busca}&quot;</strong>.</p>
            ) : (
              <>
                <p className="text-muted-foreground mb-2 text-sm">Nenhum fornecedor cadastrado ainda.</p>
                <p className="text-xs text-muted-foreground/60">Consulte um CNPJ acima ou importe uma planilha.</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* ── Seletor de anos para tabela de evolução ──────── */}
            <div className="px-4 py-3 border-b border-border/60 bg-muted/30 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider shrink-0">Evolução:</span>
              {ANOS_REFORMA.map((ano) => (
                <button
                  key={ano}
                  onClick={() => toggleAnoTabela(ano)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    anosTabela.includes(ano)
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-accent/60'
                  }`}
                >
                  {ano}
                </button>
              ))}
              <button
                onClick={() => setAnosTabela(anosTabela.length === ANOS_REFORMA.length ? [] : [...ANOS_REFORMA])}
                className="px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors ml-1"
              >
                {anosTabela.length === ANOS_REFORMA.length ? 'Limpar' : 'Todos'}
              </button>
              {anosTabela.length > 0 && (
                <span className="text-[11px] text-muted-foreground/60 ml-1">
                  — tabela de evolução abaixo
                </span>
              )}
            </div>

            {/* ── MOBILE: cards ─────────────────────────────────── */}
            <div className="md:hidden divide-y divide-border/60">
              {fornecedores.map((f) => (
                <div key={f.id} className={`p-4 space-y-2 ${confirmandoExclusaoId === f.id ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                  {/* Linha 1: CNPJ + status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground num">{formatarCnpj(f.cnpj)}</span>
                    <div className="flex items-center gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        badgeStatus[f.statusEnriquecimento as keyof typeof badgeStatus] ?? 'bg-muted'
                      }`}>
                        {labelStatus[f.statusEnriquecimento as keyof typeof labelStatus] ?? f.statusEnriquecimento}
                      </span>
                      {f.statusEnriquecimento === 'erro' && f.erroEnriquecimento && (
                        <button
                          onClick={() => {
                            if (mostrandoErroId === f.id) { setMostrandoErroId(null); setErroDetalhes(null) }
                            else { setMostrandoErroId(f.id); setErroDetalhes(f.erroEnriquecimento ?? null) }
                          }}
                          className="text-red-400 hover:text-red-600 text-xs font-bold"
                        >?</button>
                      )}
                    </div>
                  </div>
                  {/* Linha 2: nome */}
                  <p className="font-semibold text-foreground text-sm leading-snug">
                    {f.razaoSocial ?? f.nomeErp ?? '—'}
                  </p>
                  {/* Linha 3: regime + setor + crédito */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    {f.regime && (
                      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        {labelRegime(f.regime)}
                      </span>
                    )}
                    {f.setor && (
                      <span className="text-muted-foreground/70">{labelSetor(f.setor)}</span>
                    )}
                    {f.setorDiferenciadoReforma && f.reducaoAliquota && parseFloat(f.reducaoAliquota) > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                        Redutor {parseFloat(f.reducaoAliquota).toFixed(0)}%
                      </span>
                    )}
                    {f.percentualCreditoEstimado ? (
                      <span className="text-green-600 font-semibold num ml-auto">
                        {f.regime === 'mei' || f.regime === 'simples_nacional' ? 'Pres.' : 'CBS'}{' '}
                        {parseFloat(f.percentualCreditoEstimado).toFixed(2)}%
                        {f.opcaoCbsIbsPorFora && <span className="text-blue-500 font-normal ml-1">por fora</span>}
                      </span>
                    ) : null}
                  </div>
                  {/* Detalhe do erro */}
                  {mostrandoErroId === f.id && erroDetalhes && (
                    <div className="bg-red-50 dark:bg-red-900/10 rounded p-2">
                      <p className="text-xs text-red-700 dark:text-red-400 font-mono break-all">{erroDetalhes}</p>
                    </div>
                  )}
                  {/* Ações */}
                  {confirmandoExclusaoId === f.id ? (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-red-600 font-medium">Confirmar exclusão?</span>
                      <button onClick={() => excluirFornecedor(f.id)} disabled={excluindo}
                        className="text-xs text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded font-semibold disabled:opacity-40">
                        {excluindo ? '...' : 'Excluir'}
                      </button>
                      <button onClick={() => setConfirmandoExclusaoId(null)}
                        className="text-xs text-muted-foreground hover:text-foreground font-medium">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 pt-1 flex-wrap">
                      {enriquecendoId === f.id ? (
                        <span className="text-xs text-blue-600 flex items-center gap-1">
                          <span className="animate-spin inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full" />
                          Analisando...
                        </span>
                      ) : (
                        <button onClick={() => rodarEnriquecimento(f.id, 'tabela')}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                          {f.statusEnriquecimento === 'concluido' ? 'Reenriquecer' : 'Enriquecer'}
                        </button>
                      )}
                      {f.statusEnriquecimento === 'concluido' && (
                        <button
                          onClick={() => { setEvolucaoAbertaId(evolucaoAbertaId === f.id ? null : f.id); setAnosEvolucao(ANOS_REFORMA) }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                          {evolucaoAbertaId === f.id ? 'Fechar' : 'Evolução'}
                        </button>
                      )}
                      <button onClick={() => editandoId === f.id ? setEditandoId(null) : abrirEdicao(f)}
                        className="text-xs text-muted-foreground/70 hover:text-foreground font-medium">
                        {editandoId === f.id ? 'Fechar' : 'Editar'}
                      </button>
                      <button onClick={() => setConfirmandoExclusaoId(f.id)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium">
                        Excluir
                      </button>
                    </div>
                  )}
                  {/* Edição inline mobile */}
                  {editandoId === f.id && (
                    <div className="bg-muted/40 rounded-lg p-3 space-y-2 border border-border/40">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Preço ref. (R$)</label>
                        <input type="number" min="0" step="0.01" value={editPreco}
                          onChange={(e) => setEditPreco(e.target.value)} placeholder="0,00"
                          className="flex-1 min-w-0 px-2 py-1 border border-border rounded text-sm text-right bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      {(f.regime === 'simples_nacional' || f.regime === 'mei') && (
                        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                          <input type="checkbox" checked={editCbsPorFora} onChange={(e) => setEditCbsPorFora(e.target.checked)}
                            className="w-4 h-4 accent-blue-600" />
                          Recolhe CBS/IBS por fora do DAS
                        </label>
                      )}
                      <button onClick={() => salvarEdicao(f.id)} disabled={salvando}
                        className="px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:opacity-40">
                        {salvando ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  )}
                  {/* Painel de evolução mobile */}
                  {evolucaoAbertaId === f.id && (
                    <PainelEvolucao f={f} anos={anosEvolucao} onChangeAnos={setAnosEvolucao} />
                  )}
                </div>
              ))}
            </div>

            {/* ── DESKTOP: tabela ───────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto rounded-2xl">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border/60">
                  <tr>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">CNPJ</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Nome</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Regime</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Setor</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Crédito</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {fornecedores.map((f) => (
                    <React.Fragment key={f.id}>
                      <tr className={`hover:bg-accent/40 transition-colors ${confirmandoExclusaoId === f.id ? 'bg-red-50 dark:bg-red-900/10' : ''}`}>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground num whitespace-nowrap">{formatarCnpj(f.cnpj)}</td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-medium text-foreground truncate">{f.razaoSocial ?? f.nomeErp ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {f.regime ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                              {labelRegime(f.regime)}
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span>{f.setor ? labelSetor(f.setor) : '—'}</span>
                            {f.setorDiferenciadoReforma && f.reducaoAliquota && parseFloat(f.reducaoAliquota) > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 w-fit">
                                Redutor {parseFloat(f.reducaoAliquota).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {f.percentualCreditoEstimado ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-green-600 font-semibold num">
                                {f.regime === 'mei' || f.regime === 'simples_nacional' ? 'Pres.' : 'CBS'}{' '}
                                {parseFloat(f.percentualCreditoEstimado).toFixed(2)}%
                              </span>
                              {(f.regime === 'mei' || f.regime === 'simples_nacional') && (
                                <span className="text-[10px] text-muted-foreground/60">crédito presumido</span>
                              )}
                              {f.setorDiferenciadoReforma && f.reducaoAliquota && parseFloat(f.reducaoAliquota) > 0 &&
                                (f.regime === 'lucro_presumido' || f.regime === 'lucro_real') && (
                                <span className="text-[10px] text-muted-foreground/60 num">
                                  8,8% × {(100 - parseFloat(f.reducaoAliquota)).toFixed(0)}%
                                </span>
                              )}
                              {f.opcaoCbsIbsPorFora && <span className="text-[10px] text-blue-500">por fora</span>}
                            </div>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              badgeStatus[f.statusEnriquecimento as keyof typeof badgeStatus] ?? 'bg-muted'
                            }`}>
                              {labelStatus[f.statusEnriquecimento as keyof typeof labelStatus] ?? f.statusEnriquecimento}
                            </span>
                            {f.statusEnriquecimento === 'erro' && f.erroEnriquecimento && (
                              <button
                                onClick={() => {
                                  if (mostrandoErroId === f.id) { setMostrandoErroId(null); setErroDetalhes(null) }
                                  else { setMostrandoErroId(f.id); setErroDetalhes(f.erroEnriquecimento ?? null) }
                                }}
                                title="Ver detalhe do erro"
                                className="text-red-400 hover:text-red-600 text-xs font-bold leading-none"
                              >?</button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {confirmandoExclusaoId === f.id ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600 font-medium">Excluir?</span>
                              <button onClick={() => excluirFornecedor(f.id)} disabled={excluindo}
                                className="text-xs text-white bg-red-600 hover:bg-red-700 px-2 py-0.5 rounded font-semibold disabled:opacity-40">
                                {excluindo ? '...' : 'Sim'}
                              </button>
                              <button onClick={() => setConfirmandoExclusaoId(null)}
                                className="text-xs text-muted-foreground hover:text-foreground font-medium">Não</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              {enriquecendoId === f.id ? (
                                <span className="text-xs text-blue-600 flex items-center gap-1">
                                  <span className="animate-spin inline-block w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full" />
                                  Analisando...
                                </span>
                              ) : (
                                <button onClick={() => rodarEnriquecimento(f.id, 'tabela')}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                  {f.statusEnriquecimento === 'concluido' ? 'Reenriquecer' : 'Enriquecer'}
                                </button>
                              )}
                              {f.statusEnriquecimento === 'concluido' && (
                                <button
                                  onClick={() => { setEvolucaoAbertaId(evolucaoAbertaId === f.id ? null : f.id); setAnosEvolucao(ANOS_REFORMA) }}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                                  {evolucaoAbertaId === f.id ? 'Fechar' : 'Evolução'}
                                </button>
                              )}
                              <button onClick={() => editandoId === f.id ? setEditandoId(null) : abrirEdicao(f)}
                                className="text-xs text-muted-foreground/70 hover:text-foreground font-medium">
                                {editandoId === f.id ? 'Fechar' : 'Editar'}
                              </button>
                              <button onClick={() => setConfirmandoExclusaoId(f.id)}
                                className="text-xs text-red-400 hover:text-red-600 font-medium">Excluir</button>
                            </div>
                          )}
                        </td>
                      </tr>
                      {mostrandoErroId === f.id && erroDetalhes && (
                        <tr className="bg-red-50 dark:bg-red-900/10">
                          <td colSpan={7} className="px-4 py-2">
                            <p className="text-xs text-red-700 dark:text-red-400 font-mono break-all">{erroDetalhes}</p>
                          </td>
                        </tr>
                      )}
                      {editandoId === f.id && (
                        <tr className="bg-muted/40 border-b border-border/40">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="flex items-center gap-4 flex-wrap">
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-muted-foreground">Preço referência (R$)</label>
                                <input type="number" min="0" step="0.01" value={editPreco}
                                  onChange={(e) => setEditPreco(e.target.value)} placeholder="0,00"
                                  className="w-32 px-2 py-1 border border-border rounded text-sm text-right bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500" />
                              </div>
                              {(f.regime === 'simples_nacional' || f.regime === 'mei') && (
                                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                                  <input type="checkbox" checked={editCbsPorFora} onChange={(e) => setEditCbsPorFora(e.target.checked)}
                                    className="w-4 h-4 accent-blue-600" />
                                  Recolhe CBS/IBS por fora do DAS
                                </label>
                              )}
                              <button onClick={() => salvarEdicao(f.id)} disabled={salvando}
                                className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 disabled:opacity-40">
                                {salvando ? 'Salvando...' : 'Salvar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                      {evolucaoAbertaId === f.id && (
                        <tr className="bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/40">
                          <td colSpan={7} className="px-4 py-4">
                            <PainelEvolucao f={f} anos={anosEvolucao} onChangeAnos={setAnosEvolucao} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalFornecedores > POR_PAGINA && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 bg-muted/30">
                <p className="text-xs text-muted-foreground">
                  Exibindo {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, totalFornecedores)} de {totalFornecedores} fornecedores
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPagina(1)}
                    disabled={pagina === 1}
                    className="px-2 py-1 text-xs rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    ‹ Anterior
                  </button>
                  {Array.from({ length: Math.ceil(totalFornecedores / POR_PAGINA) }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === Math.ceil(totalFornecedores / POR_PAGINA) || Math.abs(p - pagina) <= 2)
                    .reduce<(number | '...')[]>((acc, p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...')
                      acc.push(p)
                      return acc
                    }, [])
                    .map((p, i) =>
                      p === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPagina(p as number)}
                          className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                            pagina === p
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'border-border bg-background hover:bg-muted'
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setPagina(p => Math.min(Math.ceil(totalFornecedores / POR_PAGINA), p + 1))}
                    disabled={pagina >= Math.ceil(totalFornecedores / POR_PAGINA)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Próxima ›
                  </button>
                  <button
                    onClick={() => setPagina(Math.ceil(totalFornecedores / POR_PAGINA))}
                    disabled={pagina >= Math.ceil(totalFornecedores / POR_PAGINA)}
                    className="px-2 py-1 text-xs rounded-lg border border-border bg-background hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Tabela de evolução anual ──────────────────────────────────────── */}
      {anosTabela.length > 0 && fornecedores.some(f => f.statusEnriquecimento === 'concluido') && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60 bg-muted/50 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold text-foreground/80 text-sm">Evolução de Crédito por Ano</h2>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                CBS + IBS por ano da transição · anos selecionados: {anosTabela.join(', ')}
              </p>
            </div>
            <button
              onClick={() => setAnosTabela([])}
              className="text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              Fechar tabela
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border/60">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider sticky left-0 bg-muted/50 min-w-[180px]">Fornecedor</th>
                  <th className="text-left px-3 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider whitespace-nowrap">Regime</th>
                  {anosTabela.map(ano => (
                    <th key={ano} className="text-right px-3 py-3 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider whitespace-nowrap">
                      {ano}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {fornecedores
                  .filter(f => f.statusEnriquecimento === 'concluido')
                  .map(f => (
                    <tr key={f.id} className="hover:bg-accent/40 transition-colors">
                      <td className="px-4 py-2.5 sticky left-0 bg-card">
                        <p className="font-medium text-foreground text-xs truncate max-w-[160px]">{f.razaoSocial ?? f.nomeErp ?? '—'}</p>
                        <p className="text-[10px] text-muted-foreground/50 font-mono num">{f.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}</p>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                          {labelRegime(f.regime ?? '')}
                        </span>
                      </td>
                      {anosTabela.map(ano => {
                        const c = calcularCreditoNoAno(f, ano)
                        return (
                          <td key={ano} className="px-3 py-2.5 text-right whitespace-nowrap">
                            {c.total === 0 ? (
                              <span className="text-muted-foreground/30 text-xs">—</span>
                            ) : (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={`text-xs font-semibold num ${
                                  f.regime === 'mei' || f.regime === 'simples_nacional'
                                    ? 'text-amber-600'
                                    : 'text-indigo-600'
                                }`}>
                                  {c.total.toFixed(2)}%
                                </span>
                                {c.creditoMensal !== null && c.creditoMensal > 0 && (
                                  <span className="text-[10px] text-green-600 num">{formatarMoeda(c.creditoMensal)}</span>
                                )}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
              </tbody>
              {/* Totais por ano */}
              {fornecedores.some(f => f.statusEnriquecimento === 'concluido' && parseFloat(f.precoReferencia ?? f.valorMedioComprasMensal ?? '0') > 0) && (
                <tfoot className="border-t-2 border-border bg-muted/30">
                  <tr>
                    <td className="px-4 py-2.5 sticky left-0 bg-muted/30">
                      <span className="text-xs font-semibold text-foreground/70">Total crédito/mês</span>
                    </td>
                    <td className="px-3 py-2.5" />
                    {anosTabela.map(ano => {
                      const total = fornecedores
                        .filter(f => f.statusEnriquecimento === 'concluido')
                        .reduce((sum, f) => {
                          const c = calcularCreditoNoAno(f, ano)
                          return sum + (c.creditoMensal ?? 0)
                        }, 0)
                      return (
                        <td key={ano} className="px-3 py-2.5 text-right whitespace-nowrap">
                          {total > 0 ? (
                            <span className="text-xs font-bold text-green-600 num">{formatarMoeda(total)}</span>
                          ) : (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
