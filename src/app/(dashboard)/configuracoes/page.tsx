'use client'

import { useState, useEffect } from 'react'
import { formatarMoeda } from '@/lib/utils'

const REGIMES = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'mei', label: 'MEI' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
  { value: 'isento', label: 'Isento / Imune' },
  { value: 'nao_identificado', label: 'Não identificado' },
]

const SETORES = [
  { value: 'industria', label: 'Indústria' },
  { value: 'comercio_atacado', label: 'Comércio Atacado' },
  { value: 'comercio_varejo', label: 'Comércio Varejo' },
  { value: 'servicos', label: 'Serviços Gerais' },
  { value: 'servicos_saude', label: 'Serviços de Saúde' },
  { value: 'servicos_educacao', label: 'Serviços de Educação' },
  { value: 'servicos_financeiros', label: 'Serviços Financeiros' },
  { value: 'agronegocio', label: 'Agronegócio' },
  { value: 'construcao_civil', label: 'Construção Civil' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'misto', label: 'Misto / Outro' },
]

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

const inputCls = 'w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow'
const labelCls = 'block text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5'

interface Empresa {
  id: string
  cnpj: string
  razaoSocial: string
  nomeFantasia?: string | null
  regime: string
  setor: string
  uf: string
  municipio: string
  faturamentoAnual?: string | null
  aliquotaIcmsAtual?: string | null
  aliquotaIssAtual?: string | null
  isExportadora: boolean
  possuiBeneficioFiscal: boolean
  descricaoBeneficio?: string | null
}

export default function ConfiguracoesPage() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // form state
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [regime, setRegime] = useState('')
  const [setor, setSetor] = useState('')
  const [uf, setUf] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [faturamentoAnual, setFaturamentoAnual] = useState('')
  const [aliquotaIcms, setAliquotaIcms] = useState('')
  const [aliquotaIss, setAliquotaIss] = useState('')

  // limpar fornecedores
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [fornecedoresExcluidos, setFornecedoresExcluidos] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/empresa')
      .then(r => r.json())
      .then(d => {
        if (d.id) {
          setEmpresa(d)
          setRazaoSocial(d.razaoSocial ?? '')
          setNomeFantasia(d.nomeFantasia ?? '')
          setRegime(d.regime ?? '')
          setSetor(d.setor ?? '')
          setUf(d.uf ?? '')
          setMunicipio(d.municipio ?? '')
          setFaturamentoAnual(d.faturamentoAnual ?? '')
          setAliquotaIcms(d.aliquotaIcmsAtual ?? '')
          setAliquotaIss(d.aliquotaIssAtual ?? '')
        }
        setCarregando(false)
      })
  }, [])

  async function salvar() {
    setSalvando(true)
    setSucesso(false)
    setErro(null)
    try {
      const res = await fetch('/api/empresa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razaoSocial: razaoSocial || undefined,
          nomeFantasia: nomeFantasia || undefined,
          regime: regime || undefined,
          setor: setor || undefined,
          uf: uf || undefined,
          municipio: municipio || undefined,
          faturamentoAnual: faturamentoAnual ? parseFloat(faturamentoAnual) : undefined,
          aliquotaIcmsAtual: aliquotaIcms ? parseFloat(aliquotaIcms) : undefined,
          aliquotaIssAtual: aliquotaIss ? parseFloat(aliquotaIss) : undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json()
        setErro(j.error ?? 'Erro ao salvar')
      } else {
        const d = await res.json()
        setEmpresa(d)
        setSucesso(true)
        setTimeout(() => setSucesso(false), 3000)
      }
    } finally {
      setSalvando(false)
    }
  }

  async function limparFornecedores() {
    setLimpando(true)
    try {
      const res = await fetch('/api/fornecedores?confirmar=sim', { method: 'DELETE' })
      const j = await res.json()
      setFornecedoresExcluidos(j.excluidos ?? 0)
      setConfirmandoLimpeza(false)
    } finally {
      setLimpando(false)
    }
  }

  const faturamentoMensal = faturamentoAnual ? parseFloat(faturamentoAnual) / 12 : null

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (!empresa) {
    return (
      <div className="p-10 text-center text-muted-foreground text-sm">
        Empresa não encontrada. Complete o onboarding primeiro.
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="text-muted-foreground/70 text-xs mt-0.5">Perfil da empresa e gestão de dados</p>
      </div>

      {/* ── Perfil da Empresa ─────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 bg-muted/50">
          <h2 className="font-semibold text-foreground/80 text-sm">Perfil da Empresa</h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            CNPJ: <span className="font-mono num">{empresa.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}</span>
            {' · '}Dados usados em todas as simulações e estratégias
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Razão Social</label>
              <input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Nome Fantasia</label>
              <input value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} placeholder="Opcional" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Regime Tributário</label>
              <select value={regime} onChange={e => setRegime(e.target.value)} className={inputCls}>
                {REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Setor de Atividade</label>
              <select value={setor} onChange={e => setSetor(e.target.value)} className={inputCls}>
                {SETORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={labelCls}>UF</label>
              <select value={uf} onChange={e => setUf(e.target.value)} className={inputCls}>
                {UFS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="col-span-1 sm:col-span-3">
              <label className={labelCls}>Município</label>
              <input value={municipio} onChange={e => setMunicipio(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Faturamento — campo mais importante */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-xl p-4">
            <label className="block text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-1.5">
              Faturamento Anual (R$)
            </label>
            <input
              type="number"
              value={faturamentoAnual}
              onChange={e => setFaturamentoAnual(e.target.value)}
              placeholder="Ex: 1200000"
              className={inputCls}
            />
            {faturamentoMensal !== null && faturamentoMensal > 0 && (
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5">
                = <span className="font-semibold num">{formatarMoeda(faturamentoMensal)}</span>/mês
                {' · '}usado em Estratégia Clientes e Dashboard
              </p>
            )}
            <p className="text-[11px] text-blue-600/70 dark:text-blue-400/60 mt-1">
              Este campo foi preenchido no onboarding inicial e pode ser atualizado aqui a qualquer momento.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Alíquota ICMS atual (%)</label>
              <input type="number" step="0.1" value={aliquotaIcms} onChange={e => setAliquotaIcms(e.target.value)} placeholder="Ex: 12" className={inputCls} />
              <p className="text-[11px] text-muted-foreground/60 mt-1">Usada no comparativo Atual × Reforma</p>
            </div>
            <div>
              <label className={labelCls}>Alíquota ISS atual (%)</label>
              <input type="number" step="0.1" value={aliquotaIss} onChange={e => setAliquotaIss(e.target.value)} placeholder="Ex: 5" className={inputCls} />
              <p className="text-[11px] text-muted-foreground/60 mt-1">Usada no comparativo Atual × Reforma</p>
            </div>
          </div>

          {erro && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
              {erro}
            </div>
          )}
          {sucesso && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-green-700 dark:text-green-400 text-sm">
              Dados salvos com sucesso.
            </div>
          )}

          <button
            onClick={salvar}
            disabled={salvando}
            className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </div>
      </div>

      {/* ── Gestão de Dados ───────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60 bg-muted/50">
          <h2 className="font-semibold text-foreground/80 text-sm">Gestão de Dados</h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Ações para limpar e reimportar dados</p>
        </div>
        <div className="p-5 space-y-4">

          {/* Limpar fornecedores */}
          <div className="border border-border rounded-xl p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Limpar todos os fornecedores</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Remove todos os fornecedores cadastrados (inclusive dados enriquecidos).
                  Use antes de reimportar uma planilha atualizada.
                  Esta ação <span className="font-semibold text-red-600">não pode ser desfeita</span>.
                </p>
              </div>
              {!confirmandoLimpeza ? (
                <button
                  onClick={() => setConfirmandoLimpeza(true)}
                  className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors shrink-0"
                >
                  Limpar fornecedores
                </button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-red-600">Confirmar?</span>
                  <button
                    onClick={limparFornecedores}
                    disabled={limpando}
                    className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl disabled:opacity-50 transition-colors"
                  >
                    {limpando ? 'Limpando...' : 'Sim, excluir tudo'}
                  </button>
                  <button
                    onClick={() => setConfirmandoLimpeza(false)}
                    className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
            {fornecedoresExcluidos !== null && (
              <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-400">
                {fornecedoresExcluidos} fornecedor(es) excluído(s). Agora você pode importar uma nova planilha em <strong>Fornecedores → Importar planilha</strong>.
              </div>
            )}
          </div>

          {/* Como atualizar */}
          <div className="bg-muted/40 rounded-xl p-4 text-xs text-muted-foreground/80 space-y-1">
            <p className="font-semibold text-foreground/70 text-[11px] uppercase tracking-wider mb-2">Como atualizar fornecedores anualmente</p>
            <p>1. Clique em <strong>Limpar fornecedores</strong> acima para zerar a base atual</p>
            <p>2. Vá em <strong>Fornecedores → Importar planilha</strong> e suba a planilha atualizada (CSV/XLSX)</p>
            <p>3. Use <strong>Enriquecer todos</strong> para processar os novos CNPJs automaticamente</p>
            <p>4. Acompanhe o progresso na barra da página de Fornecedores</p>
          </div>
        </div>
      </div>
    </div>
  )
}
