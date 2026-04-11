'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileCheck, AlertCircle, CheckCircle, Search } from 'lucide-react'

interface PreviewColuna {
  coluna: string
  valores: string[]
}

interface ResultadoImportacao {
  total: number
  inseridos: number
  precoAtualizados: number
  duplicatas: number
  pessoasFisicas: number
  erros: number
  semValor: number
  periodoDetectado: string
  colunaValorDetectada: string | null
  amostraValores: Array<{ raw: string; parsed: number; mensal: number | null }>
  cnpjsInvalidos?: string[]
  avisoFila?: string | null
  avisoCpf?: string | null
  avisoSemValor?: string | null
  avisoPrecos?: string | null
}

export default function ImportarFornecedoresPage() {
  const router = useRouter()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [arrastando, setArrastando] = useState(false)

  // Preview de colunas
  const [preview, setPreview] = useState<PreviewColuna[] | null>(null)
  const [carregandoPreview, setCarregandoPreview] = useState(false)

  // Configurações do import
  const [periodoManual, setPeriodoManual] = useState<string>('auto')
  const [colunaValorSelecionada, setColunaValorSelecionada] = useState<string>('')

  // Resultado
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const resetar = () => {
    setArquivo(null)
    setPreview(null)
    setColunaValorSelecionada('')
    setPeriodoManual('auto')
    setResultado(null)
    setErro(null)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setArrastando(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setArquivo(file)
      setPreview(null)
      setColunaValorSelecionada('')
    }
  }, [])

  const handleArquivoChange = (file: File | undefined) => {
    if (!file) return
    setArquivo(file)
    setPreview(null)
    setColunaValorSelecionada('')
    setErro(null)
  }

  async function carregarPreview() {
    if (!arquivo) return
    setCarregandoPreview(true)
    setErro(null)
    try {
      const fd = new FormData()
      fd.append('arquivo', arquivo)
      const res = await fetch('/api/fornecedores/importar/preview', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao ler arquivo'); return }
      setPreview(data.preview ?? [])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao ler arquivo')
    } finally {
      setCarregandoPreview(false)
    }
  }

  async function handleImportar() {
    if (!arquivo) return
    setEnviando(true)
    setErro(null)
    const formData = new FormData()
    formData.append('arquivo', arquivo)
    if (periodoManual !== 'auto') formData.append('periodo', periodoManual)
    if (colunaValorSelecionada) formData.append('colunaValor', colunaValorSelecionada)

    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const res = await fetch('/api/fornecedores/importar', { method: 'POST', body: formData })
        const text = await res.text()
        if (!text) { if (tentativa < 2) continue; setErro('Servidor não respondeu. Tente novamente.'); break }
        const json = JSON.parse(text)
        if (!res.ok) {
          const isConn = json.error?.includes('Connection is closed') || json.error?.includes('connection')
          if (tentativa < 2 && isConn) continue
          setErro(json.error ?? 'Erro ao importar'); break
        }
        setResultado(json); break
      } catch (e) {
        if (tentativa < 2) continue
        setErro(e instanceof Error ? e.message : 'Erro desconhecido')
      }
    }
    setEnviando(false)
  }

  // Valores de amostra da coluna selecionada no preview
  const amostraPreview = preview?.find((p) => p.coluna === colunaValorSelecionada)?.valores ?? []

  const fmtMoeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">Importar Fornecedores</h1>
        <p className="text-muted-foreground/70 text-xs mt-0.5">
          Faça upload de um arquivo CSV ou XLSX com os CNPJs dos seus fornecedores.
        </p>
      </div>

      {/* Dropzone */}
      {!resultado && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setArrastando(true) }}
          onDragLeave={() => setArrastando(false)}
          className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all cursor-default ${
            arrastando ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10' : 'border-border bg-card hover:border-blue-300 dark:hover:border-blue-700'
          }`}
        >
          {arquivo ? (
            <div className="space-y-3">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mx-auto">
                <FileCheck className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <p className="font-semibold text-foreground">{arquivo.name}</p>
              <p className="text-sm text-muted-foreground/70 num">{(arquivo.size / 1024).toFixed(1)} KB</p>
              <button onClick={resetar} className="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors">
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
                <input type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={(e) => handleArquivoChange(e.target.files?.[0])} />
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

      {/* ── Configuração antes de importar ────────────────────────────── */}
      {arquivo && !resultado && (
        <div className="space-y-3">

          {/* PASSO 1: Verificar colunas */}
          {!preview && (
            <button
              onClick={carregarPreview}
              disabled={carregandoPreview}
              className="w-full flex items-center justify-center gap-2 border border-border rounded-xl px-4 py-3 text-sm font-semibold text-foreground bg-card hover:bg-accent/50 transition-colors disabled:opacity-60"
            >
              <Search className="w-4 h-4" />
              {carregandoPreview ? 'Lendo colunas...' : 'Verificar colunas do arquivo'}
            </button>
          )}

          {/* PASSO 2: Seleção de coluna de valor */}
          {preview && (
            <div className="bg-card rounded-xl border border-border p-4 space-y-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Colunas encontradas no arquivo
                </p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">
                  Selecione qual coluna contém os valores de compra. Os 5 primeiros valores são mostrados para confirmar.
                </p>
              </div>

              <div className="divide-y divide-border/60 rounded-lg border border-border overflow-hidden">
                {preview.map((p) => {
                  const selecionada = colunaValorSelecionada === p.coluna
                  return (
                    <button
                      key={p.coluna}
                      onClick={() => setColunaValorSelecionada(selecionada ? '' : p.coluna)}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                        selecionada ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-accent/50'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                        selecionada ? 'bg-blue-600 border-blue-600' : 'border-border'
                      }`}>
                        {selecionada && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${selecionada ? 'text-blue-700 dark:text-blue-400' : 'text-foreground'}`}>
                          {p.coluna}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">
                          {p.valores.filter(Boolean).slice(0, 4).join(' · ') || '(vazio)'}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {colunaValorSelecionada && amostraPreview.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                    Primeiros valores em <code className="font-mono text-foreground/80">{colunaValorSelecionada}</code>:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {amostraPreview.filter(Boolean).slice(0, 5).map((v, i) => (
                      <code key={i} className="text-xs font-mono bg-background border border-border px-2 py-0.5 rounded text-foreground/80">
                        {v}
                      </code>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 mt-1.5">
                    Confirme que estes são os valores de compra corretos antes de importar.
                  </p>
                </div>
              )}

              {!colunaValorSelecionada && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Nenhuma coluna selecionada — o sistema tentará detectar automaticamente pelo nome da coluna.
                </p>
              )}
            </div>
          )}

          {/* PASSO 3: Período */}
          <div className="bg-card rounded-xl border border-border p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Período dos valores
            </p>
            <p className="text-xs text-muted-foreground/70">
              Se os valores na planilha são anuais, selecione "Anual" para dividir por 12 e obter o valor mensal.
            </p>
            <select
              value={periodoManual}
              onChange={(e) => setPeriodoManual(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="auto">Detectar automaticamente pelo nome da coluna</option>
              <option value="mensal">Mensal (÷ 1) — valores já são mensais</option>
              <option value="trimestral">Trimestral (÷ 3)</option>
              <option value="semestral">Semestral (÷ 6)</option>
              <option value="anual">Anual (÷ 12) — totais anuais na planilha</option>
            </select>
          </div>

          <button
            onClick={handleImportar}
            disabled={enviando}
            className="w-full bg-gradient-to-br from-blue-600 to-blue-700 text-white py-3 rounded-xl text-sm font-semibold hover:from-blue-500 hover:to-blue-700 transition-all shadow-sm shadow-blue-600/20 disabled:opacity-60"
          >
            {enviando ? 'Importando...' : `Importar ${arquivo.name}`}
          </button>
        </div>
      )}

      {/* ── Resultado ─────────────────────────────────────────────────── */}
      {resultado && (
        <div className="bg-card rounded-2xl border border-green-200 dark:border-green-800/60 p-6 space-y-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Importação concluída!</h3>
              <p className="text-xs text-muted-foreground/70 mt-0.5">Os CNPJs novos estão sendo enriquecidos em segundo plano.</p>
            </div>
          </div>

          {/* Coluna e amostra de valores lidos */}
          {resultado.colunaValorDetectada ? (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/60 rounded-xl space-y-2">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <span className="font-semibold">Coluna usada:</span>{' '}
                <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{resultado.colunaValorDetectada}</code>
                {' '}→ <span className="font-semibold">{resultado.periodoDetectado}</span>
              </p>
              {resultado.amostraValores?.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 mb-1">Amostra dos valores lidos (bruto → mensal):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {resultado.amostraValores.map((a, i) => (
                      <span key={i} className="text-[11px] font-mono bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
                        {a.raw} → {a.mensal !== null ? fmtMoeda(a.mensal) : '—'}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-blue-600/70 mt-1">
                    Se estes valores não correspondem ao esperado, reimporte selecionando a coluna correta.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/15 border border-yellow-200 dark:border-yellow-800/60 rounded-xl text-xs text-yellow-800 dark:text-yellow-300">
              Nenhuma coluna de valor encontrada. Edite o preço individualmente na tela de Fornecedores.
            </div>
          )}

          {/* Contadores */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-muted/50 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">Total de linhas</p>
              <p className="font-bold text-lg text-foreground num mt-0.5">{resultado.total}</p>
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-900/15 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">CNPJs inseridos</p>
              <p className="font-bold text-lg text-green-600 num mt-0.5">{resultado.inseridos}</p>
            </div>
            {resultado.precoAtualizados > 0 && (
              <div className="col-span-2 p-3 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/60 rounded-xl">
                <p className="text-muted-foreground/70 text-xs">Preços atualizados</p>
                <p className="font-bold text-lg text-blue-600 num mt-0.5">{resultado.precoAtualizados}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Fornecedores já cadastrados com preço corrigido.</p>
              </div>
            )}
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/15 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">Já cadastrados (sem alteração)</p>
              <p className="font-bold text-lg text-yellow-600 num mt-0.5">{resultado.duplicatas}</p>
            </div>
            <div className="p-3 bg-red-50 dark:bg-red-900/15 rounded-xl">
              <p className="text-muted-foreground/70 text-xs">Inválidos</p>
              <p className="font-bold text-lg text-red-600 num mt-0.5">{resultado.erros}</p>
            </div>
            {resultado.pessoasFisicas > 0 && (
              <div className="col-span-2 p-3 bg-purple-50 dark:bg-purple-900/15 border border-purple-200 dark:border-purple-800/60 rounded-xl">
                <p className="text-muted-foreground/70 text-xs">Pessoas físicas</p>
                <p className="font-bold text-lg text-purple-600 num mt-0.5">{resultado.pessoasFisicas}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Importadas sem crédito de CBS/IBS.</p>
              </div>
            )}
            {resultado.semValor > 0 && (
              <div className="col-span-2 p-3 bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800/60 rounded-xl">
                <p className="text-muted-foreground/70 text-xs">Sem valor de compra</p>
                <p className="font-bold text-lg text-orange-600 num mt-0.5">{resultado.semValor}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Célula vazia, zero ou texto não reconhecido ("-", "N/A"). Edite individualmente.</p>
              </div>
            )}
          </div>

          {resultado.avisoPrecos && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/60 rounded-xl text-xs text-blue-800 dark:text-blue-300">
              ✓ {resultado.avisoPrecos}
            </div>
          )}
          {resultado.avisoCpf && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/15 border border-purple-200 dark:border-purple-800/60 rounded-xl text-xs text-purple-800 dark:text-purple-300">
              {resultado.avisoCpf}
            </div>
          )}
          {resultado.avisoSemValor && (
            <div className="p-3 bg-orange-50 dark:bg-orange-900/15 border border-orange-200 dark:border-orange-800/60 rounded-xl text-xs text-orange-800 dark:text-orange-300">
              ⚠️ {resultado.avisoSemValor}
            </div>
          )}
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
                  {resultado.erros > (resultado.cnpjsInvalidos?.length ?? 0) && (
                    <span className="text-[11px] text-red-500 self-center">
                      +{resultado.erros - (resultado.cnpjsInvalidos?.length ?? 0)} não exibidos
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={resetar}
              className="flex-1 border border-border text-foreground py-2.5 rounded-xl text-sm font-semibold hover:bg-accent/50 transition-colors"
            >
              Importar outro arquivo
            </button>
            <button
              onClick={() => router.push('/fornecedores')}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
            >
              Ver fornecedores
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
