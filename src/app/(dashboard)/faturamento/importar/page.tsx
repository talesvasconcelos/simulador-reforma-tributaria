'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileCheck, AlertCircle, CheckCircle } from 'lucide-react'

interface ResultadoImportacaoFat {
  total: number
  inseridos: number
  atualizados: number
  erros: number
  anoDetectado: number | null
  colunaCompetenciaDetectada: string | null
  colunaValorDetectada: string | null
  temBreakdownClientes: boolean
}

const EXEMPLOS_COLUNAS = [
  {
    nomes: 'competencia / mes / periodo',
    descricao: 'Mês de referência',
    obrigatorio: true,
    exemplos: '"2025-01", "01/2025", "Jan/2025", "Janeiro/2025"',
  },
  {
    nomes: 'valor_total / faturamento / receita',
    descricao: 'Faturamento total do mês',
    obrigatorio: true,
    exemplos: '"150000,00", "R$ 1.200.000,50"',
  },
  {
    nomes: 'valor_b2b / b2b / privado',
    descricao: 'Receita de clientes privados (B2B)',
    obrigatorio: false,
    exemplos: '"90000,00"',
  },
  {
    nomes: 'valor_publico / publico / governo',
    descricao: 'Receita de entes públicos',
    obrigatorio: false,
    exemplos: '"30000,00"',
  },
  {
    nomes: 'valor_b2c / b2c / consumidor',
    descricao: 'Receita de consumidores finais (B2C)',
    obrigatorio: false,
    exemplos: '"30000,00"',
  },
]

export default function ImportarFaturamentoPage() {
  const router = useRouter()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacaoFat | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
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
      const res = await fetch('/api/faturamento/importar', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao importar')
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
        <h1 className="text-xl font-bold text-foreground tracking-tight">Importar Faturamento</h1>
        <p className="text-muted-foreground/70 text-xs mt-0.5">
          Faça upload de um arquivo CSV ou XLSX com o faturamento mensal da empresa.
        </p>
      </div>

      {/* Guia de colunas */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-foreground">Colunas reconhecidas</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            O sistema detecta as colunas automaticamente pelo nome do cabeçalho (sem distinção de maiúsculas).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold text-muted-foreground/70">Nomes aceitos</th>
                <th className="text-left py-2 pr-4 font-semibold text-muted-foreground/70">Descrição</th>
                <th className="text-left py-2 pr-4 font-semibold text-muted-foreground/70">Obrig.</th>
                <th className="text-left py-2 font-semibold text-muted-foreground/70">Exemplo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {EXEMPLOS_COLUNAS.map((col) => (
                <tr key={col.nomes}>
                  <td className="py-2.5 pr-4">
                    <code className="font-mono font-bold text-foreground/80 bg-muted px-1.5 py-0.5 rounded text-[11px]">
                      {col.nomes}
                    </code>
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{col.descricao}</td>
                  <td className="py-2.5 pr-4">
                    {col.obrigatorio ? (
                      <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[10px] font-semibold">
                        sim
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">não</span>
                    )}
                  </td>
                  <td className="py-2.5 text-muted-foreground/70 font-mono text-[11px]">{col.exemplos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Formatos de data */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-800 dark:text-blue-300 space-y-1">
          <p className="font-semibold">Formatos de data aceitos para a coluna de competência:</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {['"2025-01"', '"01/2025"', '"01-2025"', '"Jan/2025"', '"Jan 2025"', '"Janeiro/2025"'].map((f) => (
              <code key={f} className="bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded font-mono">{f}</code>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/60">
          Valores monetários aceitos com ou sem R$, ponto ou vírgula como separador (1.200,50 ou 1200.50).
          As colunas opcionais B2B / Público / B2C habilitam a análise de perfil de clientes no painel comparativo.
        </p>
      </div>

      {/* Dropzone */}
      {!resultado && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
          onDragLeave={() => setArrastando(false)}
          className={`border-2 border-dashed rounded-2xl p-14 text-center transition-all cursor-default ${
            arrastando
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10'
              : 'border-border bg-card hover:border-blue-300 dark:hover:border-blue-700'
          }`}
        >
          {arquivo ? (
            <div className="space-y-3">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mx-auto">
                <FileCheck className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <p className="font-semibold text-foreground">{arquivo.name}</p>
              <p className="text-sm text-muted-foreground/70 num">
                {(arquivo.size / 1024).toFixed(1)} KB
              </p>
              <button
                onClick={() => setArquivo(null)}
                className="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors"
              >
                Remover arquivo
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-14 h-14 bg-muted rounded-xl flex items-center justify-center mx-auto">
                <Upload className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Arraste o arquivo aqui</p>
                <p className="text-sm text-muted-foreground/70 mt-1">ou selecione do seu computador</p>
              </div>
              <label className="cursor-pointer px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors inline-block shadow-sm shadow-blue-600/20">
                Escolher arquivo
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="text-xs text-muted-foreground/50">CSV ou XLSX</p>
            </div>
          )}
        </div>
      )}

      {erro && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {erro}
        </div>
      )}

      {/* Resultado */}
      {resultado ? (
        <div className="bg-card rounded-2xl border border-green-200 dark:border-green-800/60 p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Importação concluída!</h3>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
                {resultado.anoDetectado ? `Dados de ${resultado.anoDetectado} salvos com sucesso.` : 'Dados salvos com sucesso.'}
              </p>
            </div>
          </div>

          {/* Colunas detectadas */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-800 dark:text-blue-300 space-y-1">
            <p>
              <span className="font-semibold">Competência:</span>{' '}
              <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
                {resultado.colunaCompetenciaDetectada}
              </code>
            </p>
            <p>
              <span className="font-semibold">Valor total:</span>{' '}
              <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">
                {resultado.colunaValorDetectada}
              </code>
            </p>
            {resultado.temBreakdownClientes ? (
              <p className="text-green-700 dark:text-green-300 font-semibold">
                Breakdown de clientes (B2B / Público / B2C) detectado — análise de perfil habilitada.
              </p>
            ) : (
              <p className="text-yellow-700 dark:text-yellow-300">
                Sem colunas de breakdown de clientes. Percentuais padrão (60% B2B / 20% Público / 20% B2C) serão usados.
              </p>
            )}
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-muted/50 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">Total de linhas</p>
              <p className="font-bold text-lg text-foreground num mt-0.5">{resultado.total}</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/15 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">Inseridos</p>
              <p className="font-bold text-lg text-green-600 num mt-0.5">{resultado.inseridos}</p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/15 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">Atualizados</p>
              <p className="font-bold text-lg text-blue-600 num mt-0.5">{resultado.atualizados}</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/15 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">Erros</p>
              <p className="font-bold text-lg text-red-600 num mt-0.5">{resultado.erros}</p>
            </div>
          </div>

          <button
            onClick={() => router.push('/comparativo')}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
          >
            Ver análise comparativa
          </button>
        </div>
      ) : (
        arquivo && (
          <button
            onClick={handleImportar}
            disabled={enviando}
            className="w-full bg-gradient-to-br from-blue-600 to-blue-700 text-white py-3 rounded-xl text-sm font-semibold hover:from-blue-500 hover:to-blue-700 transition-all shadow-sm shadow-blue-600/20 disabled:opacity-60"
          >
            {enviando ? 'Importando...' : `Importar ${arquivo.name}`}
          </button>
        )
      )}
    </div>
  )
}
