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
import { EstadoVacio } from './estado-vacio'
import { StatCard } from './stat-card'
import { Download, History, CheckCircle2, Clock, Trophy, Percent, Target, Hash } from 'lucide-react'

export function HistorialView() {
  const { tipo } = useAppStore()
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const t = montado ? tipo : 'Principal'

  const { data, isLoading } = useSWR(montado ? `/api/historial?tipo=${t}` : null, fetcher)
  const [filtro, setFiltro] = useState<'todas' | 'evaluadas' | 'pendientes'>('todas')

  const todas = data?.predicciones ?? []
  const preds = todas.filter((p: any) =>
    filtro === 'todas' ? true : filtro === 'evaluadas' ? p.evaluada : !p.evaluada
  )
  const resumen = data?.resumen ?? {}

  return (
    <div className="space-y-8">
      <PageHeader
        title="Historial de Predicciones"
        description={`Comparación de cada predicción del sorteo ${t} frente al resultado real.`}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              const url = `/api/export?tipo=${t}`
              const a = document.createElement('a')
              a.href = url
              a.download = `reporte_${t}.csv`
              document.body.appendChild(a)
              a.click()
              a.remove()
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        }
      />

      {/* KPIs resumen */}
      {resumen.totalPredicciones > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard titulo="Predicciones totales" valor={resumen.totalPredicciones ?? 0} icon={Hash} color="sky" delay={0} sub={`${resumen.evaluadas ?? 0} evaluadas`} />
          <StatCard titulo="Aciertos promedio" valor={resumen.promedioAciertos ?? 0} decimals={2} suffix=" / 5" icon={Trophy} color="emerald" delay={0.06} sub="números acertados" />
          <StatCard titulo="Hit rate" valor={(resumen.hitRate ?? 0) * 100} decimals={1} suffix="%" icon={Percent} color="amber" delay={0.12} sub="del total de números" />
          <StatCard titulo="Diff acertado" valor={(resumen.diffHitRate ?? 0) * 100} decimals={1} suffix="%" icon={Target} color="primary" delay={0.18} sub="veces acertó el diferente" />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(['todas', 'evaluadas', 'pendientes'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filtro === f ? 'default' : 'outline'}
            onClick={() => setFiltro(f)}
            className="capitalize"
          >
            {f}
            {f === 'evaluadas' && resumen.evaluadas > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px]">
                {resumen.evaluadas}
              </Badge>
            )}
            {f === 'pendientes' && (resumen.totalPredicciones - resumen.evaluadas) > 0 && (
              <Badge variant="outline" className="ml-1.5 text-[10px]">
                {resumen.totalPredicciones - resumen.evaluadas}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : preds.length === 0 ? (
        <EstadoVacio mensaje="No hay predicciones para el filtro seleccionado." />
      ) : (
        <div className="space-y-4">
          {preds.map((p: any) => {
            const reales: number[] = p.reales ?? []
            const numPredichos: number[] = p.numeros ?? []
            const hits = numPredichos.filter((n) => reales.includes(n))
            const score = p.aciertos ?? 0
            const scoreColor =
              score >= 3 ? 'text-emerald-600 dark:text-emerald-400' :
              score >= 1 ? 'text-amber-600 dark:text-amber-400' :
              'text-red-500'

            return (
              <Card key={p.id} className={p.evaluada ? 'border-l-4 border-l-emerald-500/50' : ''}>
                <CardContent className="space-y-4 p-5">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        Sorteo base:{' '}
                        <span className="font-mono text-foreground">{p.ultimoSorteo}</span>
                      </span>
                      {p.evaluada && p.resultadoFecha && (
                        <>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-xs text-muted-foreground">
                            Resultado:{' '}
                            <span className="font-mono">{p.resultadoFecha}</span>
                          </span>
                        </>
                      )}
                      <Badge variant="secondary" className="text-[10px]">
                        Conf. {p.confianza}%
                      </Badge>
                    </div>
                    {p.evaluada ? (
                      <Badge className={`gap-1 ${score >= 2 ? 'bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                        <CheckCircle2 className="h-3 w-3" />
                        <span className={scoreColor}>
                          {score}/5 aciertos{p.diffAcertado ? ' + diff ✓' : ''}
                        </span>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        Pendiente
                      </Badge>
                    )}
                  </div>

                  {/* Comparación lado a lado */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Predicción */}
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        🎯 Predicción
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {numPredichos.map((n: number) => (
                          <NumberBall
                            key={n}
                            n={n}
                            size="sm"
                            variant={
                              p.evaluada
                                ? reales.includes(n)
                                  ? 'hit'
                                  : 'miss'
                                : 'default'
                            }
                          />
                        ))}
                        <span className="text-muted-foreground">+</span>
                        <NumberBall
                          n={p.diff}
                          size="sm"
                          variant={
                            p.evaluada
                              ? p.diffAcertado
                                ? 'hit'
                                : 'miss'
                              : 'diff'
                          }
                        />
                      </div>
                    </div>

                    {/* Resultado real */}
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        ✅ Resultado real
                      </p>
                      {p.evaluada ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {reales.map((n: number) => (
                            <NumberBall
                              key={n}
                              n={n}
                              size="sm"
                              variant={hits.includes(n) ? 'hit' : 'muted'}
                            />
                          ))}
                          <span className="text-muted-foreground">+</span>
                          <NumberBall
                            n={p.rDiff}
                            size="sm"
                            variant={p.diffAcertado ? 'hit' : 'muted'}
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Esperando el próximo sorteo…
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Modelo líder */}
                  {p.modeloLider && (
                    <p className="text-xs text-muted-foreground">
                      Modelo líder al generar:{' '}
                      <span className="font-medium text-foreground">{p.modeloLider}</span>
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
