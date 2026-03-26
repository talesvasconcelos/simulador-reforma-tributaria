'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function ImportarFornecedoresPage() {
  const router = useRouter()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{
    total: number
    inseridos: number
    duplicatas: number
    erros: number
  } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
      setArquivo(file)
    }
  }, [])

  const handleImportar = async () => {
    if (!arquivo) return

    setEnviando(true)
    setErro(null)

    const formData = new FormData()
    formData.append('arquivo', arquivo)

    try {
      const res = await fetch('/api/fornecedores/importar', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error ?? 'Erro ao importar')
      }

      setResultado(json)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Importar Fornecedores</h1>
        <p className="text-slate-500 text-sm mt-1">
          Faça upload de um arquivo CSV ou XLSX com os CNPJs dos seus fornecedores.
        </p>
      </div>

      {/* Instruções */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">Formato esperado:</p>
        <p>O arquivo deve ter uma coluna chamada <code className="bg-blue-100 px-1 rounded">cnpj</code> (14 dígitos).</p>
        <p className="mt-1">Colunas opcionais: <code className="bg-blue-100 px-1 rounded">nome</code>, <code className="bg-blue-100 px-1 rounded">valor</code> (compras mensais).</p>
      </div>

      {/* Dropzone */}
      {!resultado && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
          onDragLeave={() => setArrastando(false)}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            arrastando ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white hover:border-slate-400'
          }`}
        >
          {arquivo ? (
            <div className="space-y-2">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <p className="font-medium text-slate-900">{arquivo.name}</p>
              <p className="text-sm text-slate-500">
                {(arquivo.size / 1024).toFixed(1)} KB
              </p>
              <button
                onClick={() => setArquivo(null)}
                className="text-xs text-red-500 hover:underline"
              >
                Remover
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center mx-auto text-slate-400 text-xl">
                ↑
              </div>
              <div>
                <p className="font-medium text-slate-700">Arraste o arquivo aqui</p>
                <p className="text-sm text-slate-500 mt-1">ou</p>
              </div>
              <label className="cursor-pointer px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors inline-block">
                Escolher arquivo
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="text-xs text-slate-400">CSV ou XLSX — até 15.000 CNPJs</p>
            </div>
          )}
        </div>
      )}

      {erro && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {erro}
        </div>
      )}

      {/* Resultado */}
      {resultado ? (
        <div className="bg-white rounded-xl border border-green-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600">✓</span>
            </div>
            <h3 className="font-semibold text-slate-900">Importação concluída!</h3>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Total de linhas</p>
              <p className="font-bold text-lg">{resultado.total}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-slate-500">Inseridos</p>
              <p className="font-bold text-lg text-green-600">{resultado.inseridos}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-slate-500">Duplicatas ignoradas</p>
              <p className="font-bold text-lg text-yellow-600">{resultado.duplicatas}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg">
              <p className="text-slate-500">Erros</p>
              <p className="font-bold text-lg text-red-600">{resultado.erros}</p>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Os CNPJs estão sendo enriquecidos automaticamente em segundo plano.
          </p>
          <button
            onClick={() => router.push('/fornecedores')}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Ver fornecedores
          </button>
        </div>
      ) : (
        arquivo && (
          <button
            onClick={handleImportar}
            disabled={enviando}
            className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {enviando ? 'Importando...' : `Importar ${arquivo.name}`}
          </button>
        )
      )}
    </div>
  )
}
