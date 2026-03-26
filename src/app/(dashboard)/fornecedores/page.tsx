'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatarCnpj, formatarMoeda, labelRegime, labelSetor } from '@/lib/utils'
import type { Fornecedor } from '@/types/empresa'

const badgeStatus = {
  pendente: 'bg-yellow-100 text-yellow-700',
  em_processamento: 'bg-blue-100 text-blue-700',
  concluido: 'bg-green-100 text-green-700',
  erro: 'bg-red-100 text-red-700',
  nao_encontrado: 'bg-slate-100 text-slate-600',
}

const labelStatus = {
  pendente: 'Pendente',
  em_processamento: 'Processando',
  concluido: 'Concluído',
  erro: 'Erro',
  nao_encontrado: 'Não encontrado',
}

export default function FornecedoresPage() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [carregando, setCarregando] = useState(true)
  const [progresso, setProgresso] = useState({
    total: 0, pendente: 0, emProcessamento: 0, concluido: 0, erro: 0, percentualConcluido: 0,
  })

  useEffect(() => {
    fetch('/api/fornecedores')
      .then((r) => r.json())
      .then((d) => {
        setFornecedores(d.fornecedores ?? [])
        setCarregando(false)
      })
  }, [])

  // SSE para progresso em tempo real
  useEffect(() => {
    const eventSource = new EventSource('/api/fornecedores/progresso')
    eventSource.onmessage = (e) => {
      const dados = JSON.parse(e.data)
      setProgresso(dados)
    }
    return () => eventSource.close()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Fornecedores</h1>
        <Link
          href="/fornecedores/importar"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Importar planilha
        </Link>
      </div>

      {/* Barra de progresso */}
      {progresso.total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-slate-700">
              Enriquecimento: {progresso.concluido}/{progresso.total} CNPJs processados
            </p>
            <p className="text-sm font-semibold text-blue-600">{progresso.percentualConcluido}%</p>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progresso.percentualConcluido}%` }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-xs text-slate-500">
            <span>Pendente: {progresso.pendente}</span>
            <span>Processando: {progresso.emProcessamento}</span>
            <span className="text-green-600">Concluído: {progresso.concluido}</span>
            <span className="text-red-600">Erro: {progresso.erro}</span>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {carregando ? (
          <div className="p-8 text-center text-slate-500">Carregando...</div>
        ) : fornecedores.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-500 mb-4">Nenhum fornecedor importado ainda.</p>
            <Link
              href="/fornecedores/importar"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              Importar planilha
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">CNPJ</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Regime</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Setor</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Crédito</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fornecedores.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{formatarCnpj(f.cnpj)}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 truncate max-w-xs">
                      {f.razaoSocial ?? f.nomeErp ?? '—'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {f.regime ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {labelRegime(f.regime)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {f.setor ? labelSetor(f.setor) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {f.percentualCreditoEstimado ? (
                      <span className="text-green-600 font-medium">
                        {parseFloat(f.percentualCreditoEstimado).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      badgeStatus[f.statusEnriquecimento as keyof typeof badgeStatus] ?? 'bg-slate-100'
                    }`}>
                      {labelStatus[f.statusEnriquecimento as keyof typeof labelStatus] ?? f.statusEnriquecimento}
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
