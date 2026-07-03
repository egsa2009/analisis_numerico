'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Boxes,
  LineChart,
  History,
  BrainCircuit,
  Sparkles,
} from 'lucide-react'

const LINKS = [
  { href: '/', label: 'Panel Principal', icon: LayoutDashboard, desc: 'Predicción y confianza' },
  { href: '/modelos', label: 'Modelos de IA', icon: Boxes, desc: 'Comparación y pesos' },
  { href: '/analisis', label: 'Análisis Temporal', icon: LineChart, desc: 'Series y frecuencias' },
  { href: '/historial', label: 'Historial', icon: History, desc: 'Predicciones vs realidad' },
  { href: '/aprendizaje', label: 'Auto-Aprendizaje', icon: BrainCircuit, desc: 'Decisiones del sistema' },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <div className="flex h-full flex-col">
      <Link href="/" className="mb-6 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-600 shadow-md">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-display text-base font-bold leading-tight tracking-tight">Oráculo</p>
          <p className="text-xs text-muted-foreground">Predictivo · IA</p>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {LINKS.map((l) => {
          const activo = pathname === l.href
          const Icon = l.icon
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-fast',
                activo
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', activo ? '' : 'group-hover:scale-110 transition-transform')} />
              <div className="flex flex-col">
                <span className="font-medium leading-tight">{l.label}</span>
                <span className={cn('text-[11px] leading-tight', activo ? 'text-primary-foreground/80' : 'text-muted-foreground/70')}>
                  {l.desc}
                </span>
              </div>
            </Link>
          )
        })}
      </nav>

      <div className="mt-4 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Sistema autónomo</p>
        <p className="mt-1 leading-snug">6 modelos evaluados en paralelo con ensemble adaptativo y validación walk-forward.</p>
      </div>
    </div>
  )
}
