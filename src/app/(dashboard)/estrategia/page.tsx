'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { formatarMoeda, labelRegime, labelSetor, formatarCnpj } from '@/lib/utils'
import type { AnaliseEstrategica } from '@/types/fornecedor'

const recomendacaoBadge = {
  manter: 'bg-green-100 text-green-700',
  renegociar: 'bg-yellow-100 text-yellow-700',
  avaliar_substituto: 'bg-red-100 text-red-700',
}

const recomendacaoLabel = {
  manter: 'Manter',
  renegociar: 'Renegociar',
  avaliar_substituto: 'Avaliar substituto',
}

export default function EstrategiaPage() {
  const [anoSelecionado, setAnoSelecionado] = useState(2027)
  const [analises, setAnalises] = useState<AnaliseEstrategica[]>([])
  const [resumo, setResumo] = useState<{
    totalFornecedores: number
    totalCreditoEstimadoAnual: number
    fornecedoresComRisco: number
    fornecedoresParaRenegociar: number
  } | null>(null)
  const [economiaAnual, setEconomiaAnual] = useState<Record<number, number>>({})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    setCarregando(true)
    fetch(`/api/estrategia?ano=${anoSelecionado}`)
      .then((r) => r.json())
      .then((d) => {
        setAnalises(d.analises ?? [])
        setResumo(d.resumo)
        setEconomiaAnual(d.economiaAnual ?? {})
        setCarregando(false)
      })
  }, [anoSelecionado])

  const dadosEconomia = Object.entries(economiaAnual).map(([ano, valor]) => ({
    ano: parseInt(ano),
    'Crédito Estimado': Math.round(valor),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Análise Estratégica de Compras</h1>
        <p className="text-slate-500 text-sm mt-1">
          Custo efetivo líquido por fornecedor considerando créditos de CBS e IBS
        </p>
      </div>

      {/* Seletor de ano */}
      <div className="flex gap-2">
        {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map((ano) => (
          <button
            key={ano}
            onClick={() => setAnoSelecionado(ano)}
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

      {resumo && (
        <>
          {/* Resumo executivo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Fornecedores analisados</p>
              <p className="text-2xl font-bold">{resumo.totalFornecedores}</p>
            </div>
            <div className="bg-white rounded-xl border border-green-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Crédito estimado/ano</p>
              <p className="text-2xl font-bold text-green-600">
                {formatarMoeda(resumo.totalCreditoEstimadoAnual)}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-yellow-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Para renegociar</p>
              <p className="text-2xl font-bold text-yellow-600">{resumo.fornecedoresParaRenegociar}</p>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-4">
              <p className="text-xs text-slate-500 mb-1">Com risco</p>
              <p className="text-2xl font-bold text-red-600">{resumo.fornecedoresComRisco}</p>
            </div>
          </div>

          {/* Gráfico de projeção de créditos */}
          {dadosEconomia.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900 mb-4">
                Crédito CBS+IBS estimado por ano
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dadosEconomia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => formatarMoeda(Number(v))} />
                  <Bar dataKey="Crédito Estimado" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Tabela de fornecedores */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Ranking por Custo Efetivo</h2>
        </div>
        {carregando ? (
          <div className="p-8 text-center text-slate-500">Carregando análise...</div>
        ) : analises.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Importe fornecedores e aguarde o enriquecimento para ver a análise.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Fornecedor</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Regime</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Preço/mês</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Crédito</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Custo efetivo</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {analises.map((a) => (
                <tr key={a.fornecedorId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium truncate max-w-xs">{a.nome}</p>
                    <p className="text-xs text-slate-500 font-mono">{formatarCnpj(a.cnpj)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      {labelRegime(a.regime)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{formatarMoeda(a.precoMedioMensal)}</td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">
                    {formatarMoeda(a.creditoMensal)}
                    <span className="text-xs text-slate-400 ml-1">
                      ({a.percentualCredito.toFixed(1)}%)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatarMoeda(a.custoEfetivo)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      recomendacaoBadge[a.recomendacao]
                    }`}>
                      {recomendacaoLabel[a.recomendacao]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
