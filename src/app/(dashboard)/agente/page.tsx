'use client'

import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'

interface Mensagem {
  role: 'user' | 'assistant'
  conteudo: string
  fontes?: string[]
}

const SUGESTOES = [
  'Como fica meu ISS em 2027?',
  'O que muda no Simples Nacional?',
  'Quando o ICMS acaba?',
  'Quais são as alíquotas do meu setor?',
  'O que é crédito de CBS?',
]

export default function AgentePage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const enviar = async (pergunta: string) => {
    if (!pergunta.trim() || carregando) return

    const novaMensagem: Mensagem = { role: 'user', conteudo: pergunta }
    setMensagens((prev) => [...prev, novaMensagem])
    setInput('')
    setCarregando(true)

    // Mensagem temporária do assistente
    const idxAssistente = mensagens.length + 1
    setMensagens((prev) => [...prev, { role: 'assistant', conteudo: '' }])

    try {
      const res = await fetch('/api/agente/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta, sessionId }),
      })

      if (!res.body) throw new Error('Sem stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const linhas = buffer.split('\n\n')
        buffer = linhas.pop() ?? ''

        for (const linha of linhas) {
          if (!linha.startsWith('data: ')) continue
          const dados = JSON.parse(linha.slice(6))

          if (dados.texto) {
            setMensagens((prev) => {
              const novas = [...prev]
              novas[novas.length - 1] = {
                ...novas[novas.length - 1],
                conteudo: novas[novas.length - 1].conteudo + dados.texto,
              }
              return novas
            })
          }

          if (dados.sessionId) {
            setSessionId(dados.sessionId)
          }
        }
      }
    } catch (e) {
      setMensagens((prev) => {
        const novas = [...prev]
        novas[novas.length - 1] = {
          ...novas[novas.length - 1],
          conteudo: 'Erro ao processar sua pergunta. Tente novamente.',
        }
        return novas
      })
    } finally {
      setCarregando(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Agente de Dúvidas</h1>
        <p className="text-slate-500 text-sm mt-1">
          Especialista em Reforma Tributária com base na LC 214/2025
        </p>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 p-4 space-y-4">
        {mensagens.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">💬</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">
              Como posso ajudar?
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              Tire suas dúvidas sobre a Reforma Tributária. Minhas respostas são baseadas na LC 214/2025.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-lg transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-2xl px-4 py-3 rounded-2xl text-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-900'
              }`}
            >
              {msg.role === 'assistant' && !msg.conteudo && carregando ? (
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.conteudo}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviar(input)}
          placeholder="Digite sua pergunta sobre a Reforma Tributária..."
          disabled={carregando}
          className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
        />
        <button
          onClick={() => enviar(input)}
          disabled={carregando || !input.trim()}
          className="w-12 h-12 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center justify-center"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
