'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Calculator, Users, TrendingUp,
  MessageSquare, Newspaper, BookOpen, ChevronRight, Scale, UserCheck,
  BarChart3, GitCompare, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const GRUPOS = [
  {
    label: 'Análise',
    links: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/simulador', label: 'Simulador', icon: Calculator },
      { href: '/estrategia', label: 'Estratégia Compras', icon: TrendingUp },
      { href: '/estrategia/clientes', label: 'Estratégia Clientes', icon: UserCheck },
      { href: '/comparativo', label: 'Comparativo Real × Reforma', icon: GitCompare },
    ],
  },
  {
    label: 'Cadastros',
    links: [
      { href: '/fornecedores', label: 'Fornecedores', icon: Users },
      { href: '/faturamento/importar', label: 'Faturamento', icon: BarChart3 },
      { href: '/aliquotas', label: 'Alíquotas', icon: BookOpen },
      { href: '/configuracoes', label: 'Configurações', icon: Settings },
    ],
  },
  {
    label: 'Inteligência',
    links: [
      { href: '/agente', label: 'Agente IA', icon: MessageSquare },
      { href: '/novidades', label: 'Novidades', icon: Newspaper },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-slate-950 dark:bg-slate-950 text-white flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-[18px] border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40 flex-shrink-0">
            <Scale className="w-[16px] h-[16px] text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-white leading-tight tracking-tight">Reforma Tributária</p>
            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">Simulador 2026–2033</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {GRUPOS.map((grupo) => (
          <div key={grupo.label}>
            <p className="px-3 mb-1.5 text-[9px] font-bold tracking-[0.12em] text-slate-600 uppercase select-none">
              {grupo.label}
            </p>
            <div className="space-y-0.5">
              {grupo.links.map(({ href, label, icon: Icon }) => {
                const ativo = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'group flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                      ativo
                        ? 'bg-blue-600/20 text-white border border-blue-500/25'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100 border border-transparent'
                    )}
                  >
                    <div className={cn(
                      'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors',
                      ativo
                        ? 'bg-blue-500/25 text-blue-300'
                        : 'bg-white/5 text-slate-500 group-hover:bg-white/10 group-hover:text-slate-300'
                    )}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="flex-1 tracking-tight">{label}</span>
                    {ativo && <ChevronRight className="w-3 h-3 text-blue-400/60" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-white/8">
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-[11px] text-slate-500 font-medium">LC 214/2025 · EC 132/2023</p>
        </div>
        <p className="text-[10px] text-slate-700 pl-3.5">Base legal atualizada</p>
      </div>
    </aside>
  )
}
