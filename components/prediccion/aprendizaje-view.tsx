'use client'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { useAppStore } from '@/lib/store'
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layouts/page-header'
import { EstadoVacio } from './estado-vacio'
import { motion } from 'framer-motion'
import { BrainCircuit, Sparkles, Activity, Scale, Target, GraduationCap } from 'lucide-react'

const ICONOS: Record<string, any> = {
  entrenamiento: GraduationCap, ajuste_pesos: Scale, cambio_regimen: Activity, evaluacion: Target, prediccion: Sparkles,
}
const COLORES: Record<string, string> = {
  entrenamiento: 'text-primary bg-primary/10', ajuste_pesos: 'text-sky-500 bg-sky-500/10', cambio_regimen: 'text-amber-500 bg-amber-500/10', evaluacion: 'text-emerald-500 bg-emerald-500/10', prediccion: 'text-violet-500 bg-violet-500/10',
}

export function AprendizajeView() {
  const { tipo } = useAppStore()
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const t = montado ? tipo : 'Principal'
  const [evento, setEvento] = useState<string>('')
  const { data, isLoading } = useSWR(montado ? `/api/logs?tipo=${t}${evento ? `&evento=${evento}` : ''}` : null, fetcher)
  const logs = data?.logs ?? []

  return (
    <div className="space-y-8">
      <PageHeader title="Bitácora de Auto-Aprendizaje" description={`Registro transparente de cada decisión del sistema para el sorteo ${t}: entrenamientos, ajustes de pesos, evaluaciones y cambios de régimen.`} />

      <div className="flex flex-wrap gap-2">
        {[['','Todos'],['entrenamiento','Entrenamientos'],['prediccion','Predicciones'],['evaluacion','Evaluaciones'],['cambio_regimen','Cambios de régimen']].map(([v,l]) => (
          <Button key={v} size="sm" variant={evento === v ? 'default' : 'outline'} onClick={() => setEvento(v)}>{l}</Button>
        ))}
      </div>

      {isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : logs.length === 0 ? <EstadoVacio mensaje="Aún no hay eventos registrados." /> : (
        <div className="relative space-y-4 before:absolute before:left-[19px] before:top-2 before:h-full before:w-px before:bg-border">
          {logs.map((log: any, i: number) => {
            const Icon = ICONOS[log.evento] ?? BrainCircuit
            return (
              <motion.div key={log.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.04, 0.4) }} className="relative flex gap-4 pl-1">
                <div className={`z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${COLORES[log.evento] ?? 'text-primary bg-primary/10'}`}><Icon className="h-5 w-5" /></div>
                <Card className="flex-1">
                  <CardContent className="space-y-1.5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{log.titulo}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">{(log.evento ?? '').replace('_',' ')}</Badge>
                        <span className="font-mono text-[11px] text-muted-foreground">{(log.createdAt ?? '').slice(0,16).replace('T',' ')}</span>
                      </div>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{log.detalle}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
