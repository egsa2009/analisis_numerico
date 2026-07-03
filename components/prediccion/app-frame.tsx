'use client'
import { AppShell } from '@/components/layouts/app-shell'
import { Sidebar } from './sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { Dices, Layers } from 'lucide-react'

function TipoToggle() {
  const { tipo, setTipo } = useAppStore()
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const actual = montado ? tipo : 'Principal'
  return (
    <div className="flex items-center gap-1 rounded-full border bg-secondary/50 p-1">
      {(['Principal', 'Secundario'] as const).map((t) => {
        const activo = actual === t
        const Icon = t === 'Principal' ? Dices : Layers
        return (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-fast',
              activo
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {t}
          </button>
        )
      })}
    </div>
  )
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      sidebar={<Sidebar />}
      header={
        <div className="flex flex-1 items-center justify-between">
          <span className="font-display text-sm font-semibold tracking-tight text-muted-foreground">
            Motor de Predicción Autónomo
          </span>
          <div className="flex items-center gap-3">
            <TipoToggle />
            <ThemeToggle />
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  )
}
