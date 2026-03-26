import Link from 'next/link'
import { SignInButton, SignUpButton, SignedIn, SignedOut } from '@clerk/nextjs'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      <header className="container mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-sm">RT</div>
          <span className="font-semibold text-lg">Simulador RT</span>
        </div>
        <div className="flex gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 text-sm border border-slate-600 rounded-lg hover:bg-slate-700 transition-colors">
                Entrar
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="px-4 py-2 text-sm bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                Começar grátis
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Ir para o dashboard
            </Link>
          </SignedIn>
        </div>
      </header>

      <main className="container mx-auto px-6 py-24 text-center">
        <div className="inline-block px-3 py-1 text-xs font-medium bg-blue-900 text-blue-300 rounded-full mb-6">
          LC 214/2025 — Reforma Tributária em vigor
        </div>
        <h1 className="text-5xl font-bold leading-tight mb-6 max-w-3xl mx-auto">
          Simule o impacto da{' '}
          <span className="text-blue-400">Reforma Tributária</span>{' '}
          na sua empresa
        </h1>
        <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
          CBS, IBS e IS substituindo PIS/COFINS, ICMS e ISS de 2026 a 2033.
          Descubra como a transição afeta sua carga tributária e seus fornecedores.
        </p>
        <div className="flex gap-4 justify-center">
          <SignUpButton mode="modal">
            <button className="px-8 py-3 text-base bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors font-semibold">
              Simular agora — grátis
            </button>
          </SignUpButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 text-left">
          {[
            {
              titulo: 'Simulador Tributário',
              descricao:
                'Calcule a carga líquida atual vs. nova para todos os anos da transição (2026–2033) com gráficos detalhados.',
            },
            {
              titulo: 'Análise de Fornecedores',
              descricao:
                'Importe sua lista de CNPJs e descubra o custo efetivo real de cada fornecedor após créditos de CBS e IBS.',
            },
            {
              titulo: 'Agente de Dúvidas',
              descricao:
                'Chat com IA treinado na legislação completa (LC 214/2025) para responder suas dúvidas em segundos.',
            },
          ].map((feature) => (
            <div key={feature.titulo} className="p-6 bg-slate-800 rounded-2xl border border-slate-700">
              <h3 className="font-semibold text-lg mb-2">{feature.titulo}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.descricao}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
