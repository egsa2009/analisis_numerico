'use client'
import { NOMBRES_MODELOS, ModeloId } from '@/lib/ml/tipos'
import { motion } from 'framer-motion'

const COLORS: Record<string, string> = {
  frecuencia_adaptativa: '#60B5FF',
  promedio_movil: '#FF9149',
  regresion_lineal: '#80D8C3',
  patrones_temporales: '#A19AD3',
  coocurrencia: '#FF90BB',
  red_neuronal: '#FF6363',
}

export function PesosBar({ pesos, lider }: { pesos: Record<string, number>; lider?: string }) {
  const entradas = Object.entries(pesos ?? {}).sort((a, b) => b[1] - a[1])
  if (entradas.length === 0) return null
  return (
    <div className="space-y-3">
      {entradas.map(([modelo, peso], i) => (
        <div key={modelo} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className={modelo === lider ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
              {NOMBRES_MODELOS[modelo as ModeloId] ?? modelo}
              {modelo === lider && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary">Líder</span>}
            </span>
            <span className="font-mono font-medium">{((peso ?? 0) * 100).toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: COLORS[modelo] ?? '#60B5FF' }}
              initial={{ width: 0 }}
              animate={{ width: `${(peso ?? 0) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export { COLORS as COLORES_MODELOS }
