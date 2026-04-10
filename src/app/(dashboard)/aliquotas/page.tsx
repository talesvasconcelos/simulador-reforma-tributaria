'use client'

import { useState } from 'react'
import { ALIQUOTAS_SETORIAIS } from '@/lib/simulador/aliquotas'
import { CRONOGRAMA_TRANSICAO } from '@/lib/simulador/cronograma'
import { classificarSetorPorCnae } from '@/lib/cnpj/classificador'
import { labelSetor } from '@/lib/utils'

const fmtPct = (v: number) => `${v.toFixed(2)}%`

const CBS_PADRAO = 8.8
const IBS_PADRAO = 17.7
const TOTAL_PADRAO = CBS_PADRAO + IBS_PADRAO

// Grupos visuais: cada grupo tem um setor "pai" e seus sub-setores (filhos indentados)
const GRUPOS: Array<{
  label: string
  setores: string[]
  filhos?: string[]
}> = [
  { label: 'Indústria', setores: ['industria'] },
  {
    label: 'Comércio',
    setores: ['comercio_atacado', 'comercio_varejo'],
  },
  {
    label: 'Serviços',
    setores: ['servicos'],
    filhos: ['profissionais_liberais'],
  },
  { label: 'Hotelaria', setores: ['hotelaria'] },
  {
    label: 'Saúde',
    setores: ['servicos_saude'],
    filhos: ['planos_saude', 'medicamentos_oncologicos'],
  },
  {
    label: 'Educação',
    setores: ['servicos_educacao'],
    filhos: ['cursos_livres'],
  },
  { label: 'Serviços Financeiros', setores: ['servicos_financeiros'], filhos: ['fii_fiagro'] },
  { label: 'Telecomunicações', setores: ['telecomunicacoes'] },
  {
    label: 'Agronegócio',
    setores: ['agronegocio'],
    filhos: ['insumos_agricolas'],
  },
  {
    label: 'Construção Civil',
    setores: ['construcao_civil'],
    filhos: ['construcao_edificios', 'construcao_infraestrutura', 'construcao_servicos_especializados'],
  },
  {
    label: 'Transporte',
    setores: ['transporte'],
    filhos: ['transporte_coletivo_passageiros', 'transporte_cargas'],
  },
  { label: 'Imóveis', setores: ['imoveis'] },
  { label: 'Combustíveis e Energia', setores: ['combustiveis_energia'] },
  { label: 'Tecnologia', setores: ['tecnologia'] },
  {
    label: 'Desporto e Recreação',
    setores: ['entidades_desportivas'],
    filhos: ['parques_diversao'],
  },
  { label: 'Entidades Religiosas', setores: ['entidades_religiosas'] },
  { label: 'Misto / Não classificado', setores: ['misto'] },
]

// Todos os setores filhos (indentados)
const FILHOS = new Set(GRUPOS.flatMap((g) => g.filhos ?? []))

const corReducao = (v: number, uiOnly?: boolean) => {
  if (uiOnly) return 'bg-purple-100 text-purple-700'
  if (v === 100) return 'bg-blue-100 text-blue-700'
  if (v === 60) return 'bg-green-100 text-green-700'
  if (v === 40) return 'bg-orange-100 text-orange-700'
  if (v === 30) return 'bg-yellow-100 text-yellow-700'
  return 'bg-muted text-foreground/80'
}

const labelReducao = (v: number, regime: string) => {
  if (regime === 'monofasico') return 'Monofásico'
  if (v === 100) return 'Alíq. Zero'
  if (v > 0) return `-${v}%`
  return 'Padrão'
}

const labelRegime: Record<string, string> = {
  padrao: 'Padrão',
  especial: 'Especial',
  monofasico: 'Monofásico',
}

export default function AliquotasPage() {
  const [setorSelecionado, setSetorSelecionado] = useState<string | null>(null)
  const [cnaeConsultado, setCnaeConsultado] = useState('')
  const [setorCnae, setSetorCnae] = useState<string | null>(null)
  const [erroCnae, setErroCnae] = useState('')
  const [busca, setBusca] = useState('')

  function consultarCnae() {
    const cnae = cnaeConsultado.replace(/\D/g, '')
    if (cnae.length < 4) {
      setErroCnae('Informe ao menos 4 dígitos do CNAE')
      setSetorCnae(null)
      return
    }
    setErroCnae('')
    const setor = classificarSetorPorCnae(cnae)
    setSetorCnae(setor)
    setSetorSelecionado(setor)
  }

  const setorAtivo = setorSelecionado ? ALIQUOTAS_SETORIAIS[setorSelecionado] : null

  const cbsEfetiva = setorAtivo
    ? CBS_PADRAO * (1 - Math.min(setorAtivo.reducaoPercentual, 100) / 100)
    : null
  const ibsEfetiva = setorAtivo
    ? IBS_PADRAO * (1 - Math.min(setorAtivo.reducaoPercentual, 100) / 100)
    : null
  const totalEfetivo = cbsEfetiva !== null && ibsEfetiva !== null
    ? cbsEfetiva + ibsEfetiva
    : null

  // Filtro de busca — pesquisa no label e na chave
  const buscaLower = busca.toLowerCase()
  const gruposFiltrados = busca.length >= 2
    ? GRUPOS.map((g) => {
        const setoresMatch = g.setores.filter((s) =>
          labelSetor(s).toLowerCase().includes(buscaLower) || s.includes(buscaLower)
        )
        const filhosMatch = (g.filhos ?? []).filter((s) =>
          labelSetor(s).toLowerCase().includes(buscaLower) || s.includes(buscaLower)
        )
        if (setoresMatch.length === 0 && filhosMatch.length === 0) return null
        return { ...g, setores: setoresMatch.length > 0 ? g.setores : [], filhos: filhosMatch.length > 0 ? filhosMatch : (setoresMatch.length > 0 ? g.filhos : []) }
      }).filter(Boolean)
    : GRUPOS

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Consulta de Alíquotas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tabela redutora por setor e sub-tipo de atividade — LC 214/2025 · EC 132/2023
        </p>
      </div>

      {/* Legenda — dois conceitos distintos */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div>
          <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-2">
            Redução da alíquota — o que o setor paga como vendedor/prestador
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-200 inline-block" />60% de redução sobre CBS+IBS (garantido em lei)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-200 inline-block" />40% de redução — hotelaria e parques (Arts. 281 e 283 LC 214/2025)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-yellow-200 inline-block" />30% de redução sobre CBS+IBS</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-200 inline-block" />Alíquota zero — não cobra CBS nem IBS</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-muted inline-block border border-border" />Regime padrão — CBS 8,8% + IBS 17,7% (sem desconto)</span>
          </div>
        </div>
        <div className="border-t border-border pt-3">
          <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-2">
            Crédito aproveitável — o que o comprador recupera ao adquirir deste setor
          </p>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>• Regime padrão: crédito pleno de 26,5% (Lucro Real) ou parcial (Simples Nacional)</span>
            <span>• Redução parcial (30%/60%): crédito proporcional à alíquota efetiva cobrada</span>
            <span>• Alíquota zero: <strong className="text-foreground/80">nenhum crédito</strong> — o fornecedor não cobra CBS/IBS</span>
            <span>• Monofásico: <strong className="text-foreground/80">nenhum crédito</strong> — tributo pago na origem, não se transfere</span>
            <span>• Hotelaria/parques: <strong className="text-red-600">crédito vedado em lei</strong> — Art. 283 LC 214/2025 proíbe crédito mesmo com alíquota reduzida em 40%</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground/60 border-t border-border pt-2">
          <span className="inline-flex items-center gap-1 text-purple-600 font-medium"><span className="w-2.5 h-2.5 rounded bg-purple-200 inline-block" /> Roxo:</span> item informativo — refere-se ao tipo de produto/serviço vendido, não ao CNAE da empresa compradora
        </p>
      </div>

      {/* Busca por CNAE */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-foreground/80 mb-3">Consultar pelo código CNAE</h2>
        <div className="flex gap-2 items-start">
          <div className="flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Ex: 4921301 ou 6210800"
              value={cnaeConsultado}
              onChange={(e) => { setCnaeConsultado(e.target.value); setErroCnae('') }}
              onKeyDown={(e) => e.key === 'Enter' && consultarCnae()}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {erroCnae && <p className="text-xs text-red-500 mt-1">{erroCnae}</p>}
          </div>
          <button
            onClick={consultarCnae}
            className="px-4 py-2 bg-foreground text-background text-sm font-semibold rounded-lg hover:opacity-90 transition-colors"
          >
            Consultar
          </button>
        </div>
        {setorCnae && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">CNAE {cnaeConsultado} →</span>
            <span className="font-semibold text-blue-700">{labelSetor(setorCnae)}</span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${corReducao(ALIQUOTAS_SETORIAIS[setorCnae]?.reducaoPercentual ?? 0, ALIQUOTAS_SETORIAIS[setorCnae]?.uiOnly)}`}>
              {labelReducao(ALIQUOTAS_SETORIAIS[setorCnae]?.reducaoPercentual ?? 0, ALIQUOTAS_SETORIAIS[setorCnae]?.regime ?? 'padrao')}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de setores agrupada */}
        <div className="bg-card rounded-xl border border-border lg:col-span-1">
          <div className="px-4 py-3 border-b border-border/60">
            <input
              type="text"
              placeholder="Filtrar setor ou atividade..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full px-3 py-1.5 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="divide-y divide-border/60 max-h-[600px] overflow-y-auto">
            {(gruposFiltrados as typeof GRUPOS).map((grupo) => (
              <div key={grupo.label}>
                {/* Setores principais do grupo */}
                {grupo.setores.map((s) => {
                  const info = ALIQUOTAS_SETORIAIS[s]
                  if (!info) return null
                  return (
                    <button
                      key={s}
                      onClick={() => setSetorSelecionado(s)}
                      className={`w-full text-left px-4 py-3 transition-colors hover:bg-accent/50 ${
                        setorSelecionado === s ? 'bg-blue-50 border-l-2 border-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground/80">{labelSetor(s)}</span>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${corReducao(info.reducaoPercentual, info.uiOnly)}`}>
                          {labelReducao(info.reducaoPercentual, info.regime)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{labelRegime[info.regime]}</p>
                    </button>
                  )
                })}
                {/* Sub-setores (filhos indentados) */}
                {(grupo.filhos ?? []).map((s) => {
                  const info = ALIQUOTAS_SETORIAIS[s]
                  if (!info) return null
                  return (
                    <button
                      key={s}
                      onClick={() => setSetorSelecionado(s)}
                      className={`w-full text-left px-6 py-2.5 transition-colors hover:bg-accent/50 ${
                        setorSelecionado === s ? 'bg-blue-50 border-l-2 border-blue-600' : 'bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-foreground/80">
                          <span className="text-muted-foreground/70 mr-1">↳</span>
                          {labelSetor(s)}
                          {info.uiOnly && (
                            <span className="ml-1 text-purple-500 text-xs">(produto/serviço)</span>
                          )}
                        </span>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${corReducao(info.reducaoPercentual, info.uiOnly)}`}>
                          {labelReducao(info.reducaoPercentual, info.regime)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Detalhe do setor selecionado */}
        <div className="lg:col-span-2 space-y-4">
          {!setorAtivo ? (
            <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground text-sm">
              Selecione um setor ao lado ou consulte pelo CNAE acima
            </div>
          ) : (
            <>
              {/* Card principal */}
              <div className="bg-card rounded-xl border border-border p-5 space-y-5">
                {/* Cabeçalho */}
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      {labelSetor(setorAtivo.setor)}
                    </h2>
                    {setorAtivo.uiOnly && (
                      <span className="inline-flex items-center text-xs text-purple-600 bg-purple-50 border border-purple-200 rounded px-2 py-0.5 mt-1">
                        Informativo — classificação por produto/serviço específico
                      </span>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${corReducao(setorAtivo.reducaoPercentual, setorAtivo.uiOnly)}`}>
                    {setorAtivo.regime === 'monofasico'
                      ? 'Regime Monofásico'
                      : setorAtivo.reducaoPercentual === 100
                      ? 'Alíquota Zero'
                      : setorAtivo.reducaoPercentual > 0
                      ? `Redução de ${setorAtivo.reducaoPercentual}%`
                      : 'Regime Padrão'}
                  </span>
                </div>

                {/* ── BLOCO 1: COMO VENDEDOR / PRESTADOR ── */}
                <div className="rounded-lg border border-blue-200 bg-blue-50/40 overflow-hidden">
                  <div className="px-4 py-2 bg-blue-100/60 border-b border-blue-200">
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                      Como vendedor / prestador deste setor
                    </p>
                    <p className="text-xs text-blue-700/70 mt-0.5">
                      Alíquota que incide sobre as suas próprias operações de venda ou prestação de serviço
                    </p>
                  </div>
                  <div className="p-4">
                    {setorAtivo.regime !== 'monofasico' && setorAtivo.reducaoPercentual < 100 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                          <p className="text-xs text-muted-foreground mb-1">CBS cobrada</p>
                          <p className="num text-xl font-bold text-blue-600">{fmtPct(cbsEfetiva!)}</p>
                          {setorAtivo.reducaoPercentual > 0 && (
                            <p className="text-xs text-muted-foreground/70">padrão: {fmtPct(CBS_PADRAO)}</p>
                          )}
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                          <p className="text-xs text-muted-foreground mb-1">IBS cobrado</p>
                          <p className="num text-xl font-bold text-indigo-600">{fmtPct(ibsEfetiva!)}</p>
                          {setorAtivo.reducaoPercentual > 0 && (
                            <p className="text-xs text-muted-foreground/70">padrão: {fmtPct(IBS_PADRAO)}</p>
                          )}
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-blue-200">
                          <p className="text-xs text-muted-foreground mb-1">Total (2033)</p>
                          <p className="num text-xl font-bold text-foreground">{fmtPct(totalEfetivo!)}</p>
                          {setorAtivo.reducaoPercentual > 0 && (
                            <p className="text-xs text-muted-foreground/70">padrão: {fmtPct(TOTAL_PADRAO)}</p>
                          )}
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-blue-100">
                          <p className="text-xs text-muted-foreground mb-1">Imp. Seletivo</p>
                          <p className="num text-xl font-bold">
                            {setorAtivo.sujetoImpSeletivo
                              ? <span className="text-red-600">Sim</span>
                              : <span className="text-green-600">Não</span>}
                          </p>
                          {setorAtivo.aliquotaIsEstimada && (
                            <p className="text-xs text-muted-foreground/70">~{setorAtivo.aliquotaIsEstimada}%</p>
                          )}
                        </div>
                      </div>
                    )}

                    {setorAtivo.regime === 'monofasico' && (
                      <div className="bg-white rounded-lg p-3 border border-orange-200">
                        <p className="text-sm font-bold text-orange-700">Regime Monofásico</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          O CBS e IBS são recolhidos integralmente por um único contribuinte no início da cadeia (produtor/importador). Os demais elos da cadeia não destacam tributo na nota fiscal.
                        </p>
                      </div>
                    )}

                    {setorAtivo.reducaoPercentual === 100 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white rounded-lg p-3 text-center border border-blue-200">
                          <p className="text-xs text-muted-foreground mb-1">CBS cobrada</p>
                          <p className="num text-xl font-bold text-blue-700">0,00%</p>
                          <p className="text-xs text-muted-foreground/70">alíquota zero</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-blue-200">
                          <p className="text-xs text-muted-foreground mb-1">IBS cobrado</p>
                          <p className="num text-xl font-bold text-blue-700">0,00%</p>
                          <p className="text-xs text-muted-foreground/70">alíquota zero</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border border-blue-200">
                          <p className="text-xs text-muted-foreground mb-1">Total</p>
                          <p className="num text-xl font-bold text-blue-700">0,00%</p>
                        </div>
                      </div>
                    )}

                    {setorAtivo.reducaoPercentual > 0 && setorAtivo.reducaoPercentual < 100 && (
                      <p className="text-xs text-blue-800/80 mt-3">
                        <strong>Tabela redutora:</strong> Redução de {setorAtivo.reducaoPercentual}% aplicada sobre CBS ({fmtPct(CBS_PADRAO)}) e IBS ({fmtPct(IBS_PADRAO)}).
                        {setorAtivo.reducaoPercentual === 60 && ' Benefício garantido por lei — não depende de regulamentação posterior.'}
                        {setorAtivo.reducaoPercentual === 30 && ' Percentual previsto na LC 214/2025, sujeito a confirmação em regulamentação específica.'}
                      </p>
                    )}
                  </div>
                </div>

                {/* ── BLOCO 2: COMO COMPRADOR ── */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 overflow-hidden">
                  <div className="px-4 py-2 bg-emerald-100/60 border-b border-emerald-200">
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Crédito ao comprar / contratar deste setor
                    </p>
                    <p className="text-xs text-emerald-700/70 mt-0.5">
                      O que sua empresa pode aproveitar como crédito de CBS/IBS nas aquisições deste setor
                    </p>
                  </div>
                  <div className="p-4">
                    {setorAtivo.creditoVedado ? (
                      <div className="bg-white rounded-lg p-3 border border-red-200">
                        <p className="text-sm font-bold text-red-700">Crédito vedado em lei</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          O Art. 283 da LC 214/2025 veda expressamente a apropriação de créditos de CBS e IBS pelo adquirente dos serviços de hotelaria e parques de diversão/temáticos.
                          Mesmo que o fornecedor destaque o tributo na nota, o comprador <strong>não pode registrar crédito</strong> nessas aquisições.
                        </p>
                        <p className="text-xs text-red-600 mt-2 font-medium">
                          Atenção: diferente da alíquota zero (onde o tributo simplesmente não existe), aqui o imposto é cobrado com 40% de redução, mas o crédito é proibido por disposição legal específica.
                        </p>
                      </div>
                    ) : setorAtivo.regime === 'monofasico' ? (
                      <div className="bg-white rounded-lg p-3 border border-orange-200">
                        <p className="text-sm font-bold text-orange-700">Nenhum crédito aproveitável</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          No regime monofásico o tributo é recolhido na origem e não consta destacado na nota fiscal dos elos seguintes. Sua empresa não recebe crédito de CBS/IBS nessas compras.
                        </p>
                      </div>
                    ) : setorAtivo.reducaoPercentual === 100 ? (
                      <div className="bg-white rounded-lg p-3 border border-blue-200">
                        <p className="text-sm font-bold text-blue-700">Nenhum crédito aproveitável</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          O fornecedor cobra CBS e IBS a 0% (alíquota zero). Como não há tributo cobrado, não há crédito a transferir ao comprador.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="bg-white rounded-lg p-3 text-center border border-emerald-100">
                            <p className="text-xs text-muted-foreground mb-1">Crédito de CBS</p>
                            <p className="num text-xl font-bold text-emerald-600">{fmtPct(cbsEfetiva!)}</p>
                            <p className="text-xs text-muted-foreground/70">por R$ 100 comprado</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 text-center border border-emerald-100">
                            <p className="text-xs text-muted-foreground mb-1">Crédito de IBS</p>
                            <p className="num text-xl font-bold text-teal-600">{fmtPct(ibsEfetiva!)}</p>
                            <p className="text-xs text-muted-foreground/70">por R$ 100 comprado</p>
                          </div>
                          <div className="bg-white rounded-lg p-3 text-center border border-emerald-200">
                            <p className="text-xs text-muted-foreground mb-1">Crédito total</p>
                            <p className="num text-xl font-bold text-foreground">{fmtPct(totalEfetivo!)}</p>
                            <p className="text-xs text-muted-foreground/70">Lucro Real (máximo)</p>
                          </div>
                        </div>
                        <p className="text-xs text-emerald-800/80">
                          <strong>Crédito proporcional à alíquota efetiva cobrada pelo fornecedor.</strong>{' '}
                          {setorAtivo.reducaoPercentual > 0
                            ? `Como o setor tem ${setorAtivo.reducaoPercentual}% de redução, o crédito transferido é menor que o padrão (${fmtPct(TOTAL_PADRAO)}).`
                            : `Regime padrão — crédito integral de ${fmtPct(TOTAL_PADRAO)}.`}{' '}
                          Simples Nacional: crédito aproximado de 40% do valor acima (conforme alíquota do Anexo).
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Observação detalhada */}
                <div className="p-3 bg-muted/50 border border-border rounded-lg text-xs text-foreground/80 leading-relaxed">
                  {setorAtivo.observacao}
                </div>

                {/* Alertas por particularidade */}
                {setorAtivo.setor === 'servicos_financeiros' && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
                    <strong>Alíquota progressiva:</strong> CBS+IBS de 10,85% em 2027, crescendo progressivamente até 12,5% em 2033. Diferente dos demais setores que seguem o cronograma padrão.
                  </div>
                )}

                {setorAtivo.setor === 'imoveis' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                    <strong>Redutor social (residencial e locação):</strong> A alíquota nominal é padrão, mas a BASE DE CÁLCULO é reduzida para imóveis residenciais novos e locação (arts. 259–260 LC 214/2025). O efeito prático é similar a uma redução de alíquota, mas calculado de forma diferente. Imóveis comerciais: regime geral com créditos plenos.
                  </div>
                )}

                {(setorAtivo.setor === 'construcao_infraestrutura') && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <strong>Obras públicas:</strong> Quando o contratante é um ente público, pode haver regras específicas sobre não incidência ou créditos — aguardar regulamentação do CGIBS.
                  </div>
                )}

                {setorAtivo.setor === 'transporte_coletivo_passageiros' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <strong>Táxi e aplicativos (CNAE 4923):</strong> Não há definição expressa na LC 214/2025 sobre enquadramento. Aguardar regulamentação específica para transporte por aplicativo.
                  </div>
                )}

                {setorAtivo.setor === 'agronegocio' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    <strong>Atenção — produto industrializado:</strong> A redução de 60% é apenas para produtos IN NATURA (CNAE 01–03). Alimentos processados e industrializados (CNAE 10–33) seguem o regime da Indústria — sem redução.
                  </div>
                )}
              </div>

              {/* Cronograma ano a ano — apenas para setores com regime CBS/IBS normal */}
              {setorAtivo.regime !== 'monofasico' && setorAtivo.reducaoPercentual < 100 && (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <div className="px-5 py-4 border-b border-border/60">
                    <h3 className="text-sm font-semibold text-foreground/80">
                      Cronograma de transição — {labelSetor(setorAtivo.setor)}
                    </h3>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">Alíquotas efetivas após redução setorial aplicada</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ano</th>
                          <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CBS vigente</th>
                          <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">IBS vigente</th>
                          <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-blue-700 bg-blue-50">Total efetivo</th>
                          <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">ICMS/ISS restante</th>
                          <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Marco</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {Object.values(CRONOGRAMA_TRANSICAO).map((ano) => {
                          const fator = 1 - setorAtivo.reducaoPercentual / 100
                          const cbsAno = ano.aliquotaCbs * fator
                          const ibsEfetivo = (ano.aliquotaIbs * (ano.percentualIbsVigente / 100)) * fator
                          const total = cbsAno + ibsEfetivo
                          const isAtual = ano.ano === new Date().getFullYear()
                          return (
                            <tr key={ano.ano} className={isAtual ? 'bg-blue-50' : ''}>
                              <td className="px-4 py-3 num font-bold text-foreground">
                                {ano.ano}
                                {isAtual && <span className="ml-1 text-xs text-blue-600 font-normal">(atual)</span>}
                              </td>
                              <td className="px-4 py-3 text-right num text-blue-600 font-medium">{fmtPct(cbsAno)}</td>
                              <td className="px-4 py-3 text-right num text-indigo-600 font-medium">{fmtPct(ibsEfetivo)}</td>
                              <td className="px-4 py-3 text-right num font-bold text-foreground bg-blue-50">{fmtPct(total)}</td>
                              <td className="px-4 py-3 text-right num text-muted-foreground">{ano.percentualIcmsIssRestante}%</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">{ano.observacao}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Tabela resumo — todos os setores (2033) */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border/60">
          <h3 className="text-sm font-semibold text-foreground/80">Resumo geral — todos os setores e sub-tipos (alíquotas em 2033)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Setor / Sub-tipo</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Regime</th>
                <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span title="Desconto sobre CBS/IBS cobrado pelo setor como vendedor">Redução (vendedor) ↓</span>
                </th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-blue-700">CBS cobrada</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-indigo-700">IBS cobrado</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-blue-700 bg-blue-50">
                  <span title="Igual ao crédito máximo que o comprador aproveita (Lucro Real)">Total 2033 = crédito máx.</span>
                </th>
                <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">IS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {GRUPOS.flatMap((grupo) => {
                const rows: React.ReactNode[] = []

                grupo.setores.forEach((s) => {
                  const info = ALIQUOTAS_SETORIAIS[s]
                  if (!info) return
                  const fator = 1 - Math.min(info.reducaoPercentual, 100) / 100
                  const cbs = CBS_PADRAO * fator
                  const ibs = IBS_PADRAO * fator
                  const isMonofasico = info.regime === 'monofasico'
                  const isZero = info.reducaoPercentual === 100

                  rows.push(
                    <tr
                      key={s}
                      onClick={() => setSetorSelecionado(s)}
                      className={`cursor-pointer transition-colors hover:bg-accent/50 ${setorSelecionado === s ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">{labelSetor(s)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-foreground/80">
                          {labelRegime[info.regime]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${corReducao(info.reducaoPercentual, info.uiOnly)}`}>
                          {labelReducao(info.reducaoPercentual, info.regime)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right num text-blue-600 font-medium">
                        {isMonofasico ? <span className="text-orange-600 text-xs">Monofásico</span> : isZero ? <span className="text-blue-700 font-bold">0,00%</span> : fmtPct(cbs)}
                      </td>
                      <td className="px-4 py-3 text-right num text-indigo-600 font-medium">
                        {isMonofasico ? '—' : isZero ? <span className="text-blue-700 font-bold">0,00%</span> : fmtPct(ibs)}
                      </td>
                      <td className="px-4 py-3 text-right num font-bold text-foreground bg-blue-50">
                        {isMonofasico ? <span className="text-orange-600 text-xs font-normal">ver legislação</span> : isZero ? <span className="text-blue-700">0,00%</span> : fmtPct(cbs + ibs)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {info.sujetoImpSeletivo
                          ? <span className="text-xs text-red-600 font-medium">Sim</span>
                          : <span className="text-xs text-muted-foreground/70">Não</span>}
                      </td>
                    </tr>
                  )
                })

                ;(grupo.filhos ?? []).forEach((s) => {
                  const info = ALIQUOTAS_SETORIAIS[s]
                  if (!info) return
                  const fator = 1 - Math.min(info.reducaoPercentual, 100) / 100
                  const cbs = CBS_PADRAO * fator
                  const ibs = IBS_PADRAO * fator
                  const isMonofasico = info.regime === 'monofasico'
                  const isZero = info.reducaoPercentual === 100

                  rows.push(
                    <tr
                      key={s}
                      onClick={() => setSetorSelecionado(s)}
                      className={`cursor-pointer transition-colors hover:bg-accent/50 bg-muted/30 ${setorSelecionado === s ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <span className="pl-4 flex items-center gap-1">
                          <span className="text-muted-foreground/70 text-xs">↳</span>
                          <span className={`font-medium ${info.uiOnly ? 'text-purple-700' : 'text-foreground/80'} text-xs`}>
                            {labelSetor(s)}
                          </span>
                          {info.uiOnly && <span className="text-purple-400 text-xs">(produto)</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-foreground/80">
                          {labelRegime[info.regime]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${corReducao(info.reducaoPercentual, info.uiOnly)}`}>
                          {labelReducao(info.reducaoPercentual, info.regime)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right num text-blue-600 font-medium text-xs">
                        {isMonofasico ? <span className="text-orange-600 text-xs">Monofásico</span> : isZero ? <span className="text-blue-700 font-bold">0,00%</span> : fmtPct(cbs)}
                      </td>
                      <td className="px-4 py-3 text-right num text-indigo-600 font-medium text-xs">
                        {isMonofasico ? '—' : isZero ? <span className="text-blue-700 font-bold">0,00%</span> : fmtPct(ibs)}
                      </td>
                      <td className="px-4 py-3 text-right num font-bold text-foreground bg-blue-50 text-xs">
                        {isMonofasico ? <span className="text-orange-600 font-normal">ver legislação</span> : isZero ? <span className="text-blue-700">0,00%</span> : fmtPct(cbs + ibs)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {info.sujetoImpSeletivo
                          ? <span className="text-xs text-red-600 font-medium">Sim</span>
                          : <span className="text-xs text-muted-foreground/70">Não</span>}
                      </td>
                    </tr>
                  )
                })

                return rows
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-muted/50 border-t border-border text-xs text-muted-foreground space-y-1">
          <p>
            <strong>Redução (vendedor):</strong> desconto nas alíquotas de CBS/IBS que o setor aplica nas suas próprias vendas.{' '}
            <strong>Total 2033 = crédito máximo:</strong> esse mesmo valor é o crédito que o <em>comprador</em> aproveita ao adquirir desse setor (Lucro Real) — <em>exceto hotelaria e parques</em>, cujo crédito é vedado pelo Art. 283 da LC 214/2025. Simples Nacional: ~40% do valor de crédito permitido.
          </p>
          <p>
            Sub-tipos marcados como <span className="text-purple-600">(produto)</span> são informativos — referem-se ao tipo de produto/serviço vendido, não ao CNAE da empresa compradora.
            Clique em qualquer linha para ver o detalhe completo.
          </p>
        </div>
      </div>
    </div>
  )
}
