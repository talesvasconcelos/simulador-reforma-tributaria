'use client'

import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-8 h-8" />

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
      className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
    >
      <Sun className={`w-4 h-4 transition-all ${isDark ? 'scale-0 opacity-0 absolute' : 'scale-100 opacity-100'}`} />
      <Moon className={`w-4 h-4 transition-all ${isDark ? 'scale-100 opacity-100' : 'scale-0 opacity-0 absolute'}`} />
    </button>
  )
}
