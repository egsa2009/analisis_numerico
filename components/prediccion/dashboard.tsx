'use client'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { useAppStore } from '@/lib/store'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layouts/page-header'
import { NumberBall } from './number-ball'
import { IngresoInline } from './ingreso-inline'
import { StatCard } from './stat-card'
import { PesosBar } from './pesos-bar'
import { EstadoVacio } from './estado-vacio'
import { SorteosRecientes } from './sorteos-recientes'
import { NOMBRES_MODELOS, ModeloId } from '@/lib/ml/tipos'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Sparkles,
  RefreshCw,
  Target,
  Trophy,
  Percent,
  Database,
  Info,
  Crown,
  Activity,
  Zap,
} from 'lucide-react'

export function Dashboard() {
  const { tipo } = useAppStore()
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const tActual = montado ? tipo : 'Principal'

  const { data: pred, mutate: mutarPred, isLoading } = useSWR(
    montado ? `/api/prediccion?tipo=${tActual}` : null,
    fetcher
  )
  const { data: hist } = useSWR(montado ? `/api/historial?tipo=${tActual}` : null, fetcher)
  const { data: analisis } = useSWR(montado ? `/api/analisis?tipo=${tActual}` : null, fetcher)
  const { data: recientes, mutate: mutarRecientes } = useSWR(
    montado ? `/api/sorteos-recientes?limite=30` : null,
    fetcher
  )

  const [regenerando, setRegenerando] = useState(false)
  const [reentrenando, setReentrenando] = useState(false)

  const prediccion = pred?.prediccion ?? null
  const numeros: number[] = prediccion?.numeros ?? []
  const pesos: Record<string, number> = prediccion?.pesos ?? {}
  const resumen = hist?.resumen ?? {}
  const totalSorteos = (recientes?.totalPrincipal ?? 0) + (recientes?.totalSecundario ?? 0)

  async function regenerar() {
    setRegenerando(true)
    try {
      const res = await fetch('/api/prediccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tActual }),
      })
      const data = await res.json()
      if (data?.ok) {
        await mutarPred()
        toast.success('Nueva predicción generada por el ensemble')
      } else {
        toast.error(data?.mensaje ?? 'No se pudo generar')
      }
    } catch {
      toast.error('Error al generar la predicción')
    } finally {
      setRegenerando(false)
    }
  }

  async function reentrenar() {
    setReentrenando(true)
    try {
      const res = await fetch('/api/entrenar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tActual }),
      })
      const data = await res.json()
      if (data?.ok) {
        await mutarPred()
        await mutarRecientes()
        toast.success('Modelos re-entrenados y nueva predicción generada')
      } else {
        toast.error(data?.mensaje ?? 'No se pudo re-entrenar')
      }
    } catch {
      toast.error('Error al re-entrenar')
    } finally {
      setReentrenando(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Panel Predictivo"
        description={`Predicción autogenerada para el sorteo ${tActual} mediante ensemble de 6 modelos con auto-aprendizaje.`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={reentrenar} loading={reentrenando} title="Re-entrena todos los modelos desde cero con los datos actuales">
              <Zap className="mr-2 h-4 w-4 text-violet-500" />
              Re-entrenar modelos
            </Button>
            <Button onClick={regenerar} loading={regenerando}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerar predicción
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard titulo="Confianza actual" valor={prediccion?.confianza ?? 0} suffix="%" icon={Target} color="primary" delay={0} sub="del ensemble" />
        <StatCard titulo="Aciertos promedio" valor={resumen?.promedioAciertos ?? 0} decimals={2} suffix=" / 5" icon={Trophy} color="emerald" delay={0.08} sub={`${resumen?.evaluadas ?? 0} predicciones evaluadas`} />
        <StatCard titulo="Tasa de acierto" valor={(resumen?.hitRate ?? 0) * 100} decimals={1} suffix="%" icon={Percent} color="amber" delay={0.16} sub="números acertados" />
        <StatCard titulo="Sorteos totales" valor={totalSorteos} icon={Database} color="sky" delay={0.24} sub={`${recientes?.totalPrincipal ?? 0} Principal · ${recientes?.totalSecundario ?? 0} Secundario`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Predicción destacada */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-2"
        >
          <Card className="relative overflow-hidden">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Combinación recomendada — {tActual}
                </CardTitle>
                <Badge variant="secondary" className="gap-1">
                  <Activity className="h-3 w-3" /> Ensemble
                </Badge>
              </div>
              <CardDescription>
                Basada en el último sorteo conocido ({prediccion?.ultimoSorteo || '—'})
              </CardDescription>
            </CardHeader>
            <CardContent className="relative space-y-6">
              {isLoading ? (
                <div className="flex gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-14 w-14 animate-pulse rounded-full bg-muted" />
                  ))}
                </div>
              ) : numeros.length > 0 ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    {numeros.map((n, i) => (
                      <motion.div
                        key={n}
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ delay: i * 0.1, type: 'spring', stiffness: 200 }}
                      >
                        <NumberBall n={n} size="lg" />
                      </motion.div>
                    ))}
                    <span className="px-1 text-2xl text-muted-foreground">+</span>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: 'spring', stiffness: 200 }}>
                      <NumberBall n={prediccion?.diff} variant="diff" size="lg" />
                    </motion.div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg bg-primary/5 p-3 text-sm">
                    <Crown className="h-4 w-4 shrink-0 text-primary" />
                    <span>
                      Modelo líder:{' '}
                      <strong>{NOMBRES_MODELOS[prediccion?.modeloLider as ModeloId] ?? '—'}</strong>
                    </span>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="leading-relaxed">{prediccion?.explicacion}</p>
                  </div>
                </>
              ) : (
                <EstadoVacio mensaje={pred?.mensaje ?? 'Aún no hay predicción disponible.'} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Pesos de modelos */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Pesos adaptativos</CardTitle>
              <CardDescription>Contribución de cada modelo al ensemble</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(pesos).length > 0 ? (
                <PesosBar pesos={pesos} lider={prediccion?.modeloLider} />
              ) : (
                <EstadoVacio mensaje="Sin pesos calculados todavía." />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Cambio de régimen */}
      {analisis?.regimen?.cambio && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="flex items-center gap-3 py-4">
              <Activity className="h-5 w-5 text-amber-500" />
              <p className="text-sm">
                <strong>Cambio de régimen detectado</strong> — la distribución reciente diverge{' '}
                {((analisis?.regimen?.divergencia ?? 0) * 100).toFixed(0)}% del histórico. El sistema prioriza modelos reactivos a datos recientes.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Ingresar sorteo real */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
        <IngresoInline />
      </motion.div>

      {/* Últimos sorteos - ambos tipos */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
        <SorteosRecientes limite={30} mostrarTipo={true} />
      </motion.div>
    </div>
  )
}
