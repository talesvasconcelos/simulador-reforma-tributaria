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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Simulador Tributário</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Parâmetros</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Regime</label>
              <select
                value={params.regime}
                onChange={(e) => setParams((p) => ({ ...p, regime: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="simples_nacional">Simples Nacional</option>
                <option value="mei">MEI</option>
                <option value="lucro_presumido">Lucro Presumido</option>
                <option value="lucro_real">Lucro Real</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Setor</label>
              <select
                value={params.setor}
                onChange={(e) => setParams((p) => ({ ...p, setor: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="servicos">Serviços</option>
                <option value="servicos_saude">Serviços de Saúde</option>
                <option value="servicos_educacao">Serviços de Educação</option>
                <option value="industria">Indústria</option>
                <option value="comercio_varejo">Comércio Varejo</option>
                <option value="agronegocio">Agronegócio</option>
                <option value="construcao_civil">Construção Civil</option>
                <option value="tecnologia">Tecnologia</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Faturamento Anual (R$)
              </label>
              <input
                type="number"
                value={params.faturamentoAnual}
                onChange={(e) =>
                  setParams((p) => ({ ...p, faturamentoAnual: Number(e.target.value) }))
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">ICMS (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={params.aliquotaIcms}
                  onChange={(e) =>
                    setParams((p) => ({ ...p, aliquotaIcms: Number(e.target.value) }))
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">ISS (%)</label>
                <input
                  type="number"
                  step="0.5"
                  value={params.aliquotaIss}
                  onChange={(e) =>
                    setParams((p) => ({ ...p, aliquotaIss: Number(e.target.value) }))
                  }
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">
                Compras Anuais (R$)
              </label>
              <input
                type="number"
                value={params.comprasAnuais}
                onChange={(e) =>
                  setParams((p) => ({ ...p, comprasAnuais: Number(e.target.value) }))
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={calcular}
              disabled={carregando}
              className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {carregando ? 'Calculando...' : 'Calcular'}
            </button>
          </div>
        </div>

        {/* Resultados */}
        <div className="lg:col-span-2 space-y-4">
          {/* Seletor de ano */}
          <div className="flex gap-2 flex-wrap">
            {anos.map((ano) => (
              <button
                key={ano}
                onClick={() => {
                  setAnoSelecionado(ano)
                  if (resultado) calcular()
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  anoSelecionado === ano
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {ano}
              </button>
            ))}
          </div>

          {resultado && (
            <>
              {/* Cards de resultado */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 mb-1">Carga Atual</p>
                  <p className="text-lg font-bold">{formatarMoeda(resultado.cargaAtual)}</p>
                </div>
                <div className={`bg-white rounded-xl border p-4 ${
                  resultado.variacaoPercentual > 0 ? 'border-red-200' : 'border-green-200'
                }`}>
                  <p className="text-xs text-slate-500 mb-1">Carga Futura</p>
                  <p className="text-lg font-bold">{formatarMoeda(resultado.cargaFutura)}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500 mb-1">Variação</p>
                  <p className={`text-lg font-bold ${
                    resultado.variacaoPercentual > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {resultado.variacaoPercentual > 0 ? '+' : ''}
                    {resultado.variacaoPercentual.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-white rounded-xl border border-green-200 p-4">
                  <p className="text-xs text-slate-500 mb-1">Créditos Estimados</p>
                  <p className="text-lg font-bold text-green-600">
                    {formatarMoeda(resultado.creditos.totalCredito)}
                  </p>
                </div>
              </div>

              {/* Alertas */}
              {resultado.alertas.length > 0 && (
                <div className="space-y-2">
                  {resultado.alertas.map((alerta, i) => (
                    <div
                      key={i}
                      className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm"
                    >
                      {alerta}
                    </div>
                  ))}
                </div>
              )}

              {/* Gráfico comparativo */}
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900 mb-4">Comparativo por Tributo</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dadosGraficoComparativo}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tributo" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
                    <Legend />
                    <Bar dataKey="atual" name="Sistema Atual" fill="#94a3b8" />
                    <Bar dataKey="futuro" name="Sistema Novo" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* Gráfico de projeção */}
          {projecao && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900 mb-4">Projeção 2026–2033</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dadosGraficoProjecao}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatarMoeda(Number(value))} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Carga Atual"
                    stroke="#94a3b8"
                    strokeDasharray="5 5"
                  />
                  <Line type="monotone" dataKey="Carga Futura" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
