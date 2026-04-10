'use client'

import { UserButton, OrganizationSwitcher } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'

const TITULOS: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Visão executiva do impacto tributário' },
  '/simulador': { title: 'Simulador Tributário', subtitle: 'Cálculo de impacto 2026–2033' },
  '/fornecedores': { title: 'Fornecedores', subtitle: 'Gestão e enriquecimento de CNPJs' },
  '/fornecedores/importar': { title: 'Importar Fornecedores', subtitle: 'Upload de planilha CSV/XLSX' },
  '/fornecedores/comparar': { title: 'Comparar Fornecedores', subtitle: 'Custo efetivo após créditos CBS+IBS' },
  '/estrategia': { title: 'Estratégia de Compras', subtitle: 'Análise de impacto por fornecedor' },
  '/aliquotas': { title: 'Consulta de Alíquotas', subtitle: 'Tabela redutora setorial — LC 214/2025' },
  '/agente': { title: 'Agente IA', subtitle: 'Consultoria baseada na legislação' },
  '/novidades': { title: 'Novidades', subtitle: 'Legislação e regulamentações recentes' },
}

export function Header() {
  const pathname = usePathname()

  const info = TITULOS[pathname] ??
    Object.entries(TITULOS)
      .filter(([k]) => pathname.startsWith(k + '/'))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ??
    { title: 'Simulador RT', subtitle: '' }

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10 backdrop-blur-sm bg-card/95">
      <div className="hidden sm:block">
        <h2 className="text-sm font-bold text-foreground leading-tight tracking-tight">{info.title}</h2>
        {info.subtitle && (
          <p className="text-xs text-muted-foreground leading-tight mt-0.5">{info.subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden md:block">
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/onboarding"
            afterSelectOrganizationUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: 'text-sm',
                organizationSwitcherTrigger:
                  'py-1.5 px-3 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-accent transition-colors',
              },
            }}
          />
        </div>
        <div className="w-px h-5 bg-border" />
        <ThemeToggle />
        <div className="w-px h-5 bg-border" />
        <UserButton
          appearance={{ elements: { avatarBox: 'w-8 h-8' } }}
        />
      </div>
    </header>
  )
}
