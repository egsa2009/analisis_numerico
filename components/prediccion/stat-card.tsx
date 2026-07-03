'use client'
import { Card } from '@/components/ui/card'
import { CountUp } from './count-up'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

export function StatCard({
  titulo,
  valor,
  decimals = 0,
  suffix = '',
  icon: Icon,
  color = 'primary',
  sub,
  delay = 0,
}: {
  titulo: string
  valor: number
  decimals?: number
  suffix?: string
  icon: LucideIcon
  color?: 'primary' | 'emerald' | 'amber' | 'sky' | 'rose'
  sub?: string
  delay?: number
}) {
  const colores: Record<string, string> = {
    primary: 'from-primary/15 to-violet-500/5 text-primary',
    emerald: 'from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400',
    amber: 'from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400',
    sky: 'from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400',
    rose: 'from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="relative overflow-hidden p-5">
        <div className={cn('absolute inset-0 bg-gradient-to-br opacity-70', colores[color])} />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
            <p className="mt-2 font-display text-3xl font-bold tracking-tight">
              <CountUp value={valor} decimals={decimals} suffix={suffix} />
            </p>
            {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl bg-background/60 backdrop-blur', colores[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </Card>
    </motion.div>
  )
}
