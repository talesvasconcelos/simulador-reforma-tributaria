'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileCheck, AlertCircle, CheckCircle } from 'lucide-react'

interface ResultadoImportacao {
  total: number
  inseridos: number
  duplicatas: number
  pessoasFisicas: number
  erros: number
  periodoDetectado: string
  colunaValorDetectada: string | null
  cnpjsInvalidos?: string[]
  avisoFila?: string | null
}

const EXEMPLOS_COLUNAS = [
  { nome: 'valor_mensal', periodo: 'Mensal', divisor: '÷ 1', exemplo: '1.200,00 → R$ 1.200/mês' },
  { nome: 'valor_trimestral', periodo: 'Trimestral', divisor: '÷ 3', exemplo: '3.600,00 → R$ 1.200/mês' },
  { nome: 'valor_semestral', periodo: 'Semestral', divisor: '÷ 6', exemplo: '7.200,00 → R$ 1.200/mês' },
  { nome: 'valor_anual', periodo: 'Anual', divisor: '÷ 12', exemplo: '14.400,00 → R$ 1.200/mês' },
  { nome: 'total_ano', periodo: 'Anual', divisor: '÷ 12', exemplo: '14.400,00 → R$ 1.200/mês' },
]

export default function ImportarFornecedoresPage() {
  const router = useRouter()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)
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

    // Tenta até 2 vezes — primeira pode falhar por cold start do servidor
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const res = await fetch('/api/fornecedores/importar', { method: 'POST', body: formData })
        const text = await res.text()
        if (!text) {
          if (tentativa < 2) continue  // corpo vazio → servidor reiniciando, tenta de novo
          setErro('Servidor não respondeu. Tente novamente.')
          break
        }
        const json = JSON.parse(text)
        if (!res.ok) {
          // Retry em cold start / connection errors
          const isConnectionError = json.error?.includes('Connection is closed') || json.error?.includes('connection')
          if (tentativa < 2 && isConnectionError) continue
          setErro(json.error ?? 'Erro ao importar')
          break
        }
        setResultado(json)
        break
      } catch (e) {
        if (tentativa < 2) continue  // retry silencioso
        setErro(e instanceof Error ? e.message : 'Erro desconhecido')
      }
    }
    setEnviando(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Importar Fornecedores</h1>
        <p className="text-muted-foreground/70 text-xs mt-0.5">
          Faça upload de um arquivo CSV ou XLSX com os CNPJs dos seus fornecedores.
        </p>
      </div>

      {/* Guia de colunas */}
      <div className="bg-card rounded-2xl border border-border p-5 space-y-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-foreground">Colunas reconhecidas</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            O sistema detecta automaticamente o período pelo nome da coluna e converte para valor mensal.
          </p>
        </div>

        {/* Obrigatória */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Obrigatória</p>
          <div className="flex items-center gap-3 p-2.5 bg-blue-50 dark:bg-blue-900/15 rounded-lg border border-blue-200 dark:border-blue-800/60">
            <code className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">cnpj</code>
            <span className="text-xs text-blue-800 dark:text-blue-300">14 dígitos — com ou sem formatação (00.000.000/0001-00 ou 00000000000100)</span>
          </div>
        </div>

        {/* Opcionais */}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opcionais</p>
          <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg border border-border">
            <code className="text-xs font-mono font-bold text-foreground/70 bg-muted px-1.5 py-0.5 rounded">nome</code>
            <span className="text-xs text-muted-foreground">ou <code className="font-mono">razao</code>, <code className="font-mono">fornecedor</code> — nome do fornecedor</span>
          </div>
        </div>

        {/* Tabela de períodos */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coluna de valor — nomes aceitos por período</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground/70">Nome da coluna</th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground/70">Período</th>
                  <th className="text-left py-2 pr-4 font-semibold text-muted-foreground/70">Conversão</th>
                  <th className="text-left py-2 font-semibold text-muted-foreground/70">Exemplo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {EXEMPLOS_COLUNAS.map((ex) => (
                  <tr key={ex.nome}>
                    <td className="py-2 pr-4">
                      <code className="font-mono font-bold text-foreground/80 bg-muted px-1.5 py-0.5 rounded">{ex.nome}</code>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{ex.periodo}</td>
                    <td className="py-2 pr-4 text-muted-foreground font-mono">{ex.divisor}</td>
                    <td className="py-2 text-muted-foreground/70">{ex.exemplo}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 pr-4">
                    <code className="font-mono font-bold text-foreground/80 bg-muted px-1.5 py-0.5 rounded">valor</code>
                    <span className="text-muted-foreground/50 ml-1">ou</span>
                    <code className="font-mono font-bold text-foreground/80 bg-muted px-1.5 py-0.5 rounded ml-1">compra</code>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">Mensal <span className="text-muted-foreground/50">(assumido)</span></td>
                  <td className="py-2 pr-4 text-muted-foreground font-mono">÷ 1</td>
                  <td className="py-2 text-muted-foreground/70">1.200,00 → R$ 1.200/mês</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Valores aceitos: com ou sem R$, vírgula ou ponto como decimal (1.200,50 ou 1200.50).
          </p>
        </div>
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
              <p className="text-xs text-muted-foreground/50">CSV ou XLSX — até 15.000 CNPJs</p>
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
              <p className="text-xs text-muted-foreground/70 mt-0.5">Os CNPJs estão sendo enriquecidos em segundo plano.</p>
            </div>
          </div>

          {/* Período detectado */}
          {resultado.colunaValorDetectada && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-800 dark:text-blue-300">
              <span className="font-semibold">Coluna de valor detectada:</span>{' '}
              <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{resultado.colunaValorDetectada}</code>
              {' '}→ interpretado como <span className="font-semibold">{resultado.periodoDetectado}</span> e convertido para valor mensal.
            </div>
          )}
          {!resultado.colunaValorDetectada && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/15 border border-yellow-200 dark:border-yellow-800/60 rounded-xl text-xs text-yellow-800 dark:text-yellow-300">
              Nenhuma coluna de valor encontrada. Os fornecedores foram importados sem valor de compra — edite individualmente na tela de Fornecedores.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-muted/50 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">Total de linhas</p>
              <p className="font-bold text-lg text-foreground num mt-0.5">{resultado.total}</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/15 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">CNPJs inseridos</p>
              <p className="font-bold text-lg text-green-600 num mt-0.5">{resultado.inseridos}</p>
            </div>
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/15 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">Duplicatas ignoradas</p>
              <p className="font-bold text-lg text-yellow-600 num mt-0.5">{resultado.duplicatas}</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/15 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">Inválidos</p>
              <p className="font-bold text-lg text-red-600 num mt-0.5">{resultado.erros}</p>
            </div>
            {resultado.pessoasFisicas > 0 && (
              <div className="col-span-2 p-3 bg-purple-50 dark:bg-purple-900/15 border border-purple-200 dark:border-purple-800/60 rounded-xl">
                <p className="text-muted-foreground/70 text-xs">Pessoas físicas (CPF)</p>
                <p className="font-bold text-lg text-purple-600 num mt-0.5">{resultado.pessoasFisicas}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Inseridas sem enriquecimento — sem crédito de CBS/IBS na Reforma Tributária.</p>
              </div>
            )}
          </div>
          {resultado.avisoFila && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/15 border border-yellow-200 dark:border-yellow-800/60 rounded-xl text-xs text-yellow-800 dark:text-yellow-300">
              ⚠️ {resultado.avisoFila}
            </div>
          )}

          {resultado.erros > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/60 rounded-xl space-y-2">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">
                {resultado.erros} linha{resultado.erros > 1 ? 's' : ''} com erro:
              </p>
              {resultado.cnpjsInvalidos && resultado.cnpjsInvalidos.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {resultado.cnpjsInvalidos.map((c, i) => (
                    <code key={i} className="text-[11px] font-mono bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                      {c}
                    </code>
                  ))}
                  {resultado.erros > resultado.cnpjsInvalidos.length && (
                    <span className="text-[11px] text-red-500 self-center">
                      +{resultado.erros - resultado.cnpjsInvalidos.length} não exibidos (ver log do Vercel)
                    </span>
                  )}
                </div>
              )}
              <p className="text-[11px] text-red-600/70 dark:text-red-400/60">
                CPFs (11 dígitos) não são aceitos. CNPJs inválidos podem ter dígito verificador errado ou estar formatados incorretamente na planilha.
              </p>
            </div>
          )}

          <button
            onClick={() => router.push('/fornecedores')}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
          >
            Ver fornecedores
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
