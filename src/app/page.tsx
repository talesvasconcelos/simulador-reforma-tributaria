import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { Scale, Calculator, Users, MessageSquare, ArrowRight } from 'lucide-react'

const features = [
  {
    icon: Calculator,
    titulo: 'Simulador Tributário',
    descricao: 'Calcule a carga líquida atual vs. nova para todos os anos da transição (2026–2033) com gráficos detalhados.',
  },
  {
    icon: Users,
    titulo: 'Análise de Fornecedores',
    descricao: 'Importe sua lista de CNPJs e descubra o custo efetivo real de cada fornecedor após créditos de CBS e IBS.',
  },
  {
    icon: MessageSquare,
    titulo: 'Agente de Dúvidas',
    descricao: 'Chat com IA treinado na legislação completa (LC 214/2025) para responder suas dúvidas em segundos.',
  },
]

export default async function LandingPage() {
  let userId: string | null = null
  try {
    const authResult = await auth()
    userId = authResult.userId
  } catch {
    userId = null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="container mx-auto px-6 py-5 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/50">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm text-white leading-tight">Reforma Tributária</p>
            <p className="text-[10px] text-slate-500 leading-tight">Simulador 2026–2033</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {userId ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-sm shadow-blue-900/50"
            >
              Ir para o dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="px-4 py-2 text-sm border border-white/10 rounded-xl hover:bg-white/5 transition-colors text-slate-300"
              >
                Entrar
              </Link>
              <Link
                href="/sign-up"
                className="px-4 py-2 text-sm bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors font-semibold shadow-sm shadow-blue-900/50"
              >
                Começar grátis
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="container mx-auto px-6 pt-28 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/40 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          LC 214/2025 — Reforma Tributária em vigor
        </div>
        <h1 className="text-5xl font-bold leading-[1.1] mb-6 max-w-3xl mx-auto tracking-tight">
          Simule o impacto da{' '}
          <span className="bg-gradient-to-r from-blue-400 to-blue-300 bg-clip-text text-transparent">
            Reforma Tributária
          </span>{' '}
          na sua empresa
        </h1>
        <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto leading-relaxed">
          CBS, IBS e IS substituindo PIS/COFINS, ICMS e ISS de 2026 a 2033.
          Descubra como a transição afeta sua carga tributária.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/sign-up"
            className="flex items-center gap-2 px-7 py-3.5 text-sm bg-blue-600 rounded-2xl hover:bg-blue-700 transition-colors font-semibold shadow-lg shadow-blue-900/50"
          >
            Simular agora — grátis <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 mt-14 text-center">
          {[
            { valor: '2026–2033', label: 'Anos de transição' },
            { valor: '15k+', label: 'CNPJs por planilha' },
            { valor: 'LC 214/2025', label: 'Base legal atualizada' },
          ].map((s) => (
            <div key={s.valor}>
              <p className="text-2xl font-bold text-white">{s.valor}</p>
              <p className="text-xs text-slate-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Features */}
      <section className="container mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.titulo}
              className="p-6 bg-slate-900/60 rounded-2xl border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-900/40 rounded-xl flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-blue-400" />
              </div>
              <h3 className="font-semibold text-base text-white mb-2">{f.titulo}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.descricao}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <p className="text-xs text-slate-600">EC 132/2023 · LC 214/2025 · Base legal atualizada</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-xs text-slate-600">Sistema ativo</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
