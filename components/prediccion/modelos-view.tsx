'use client'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { useAppStore } from '@/lib/store'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layouts/page-header'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EstadoVacio } from './estado-vacio'
import { COLORES_MODELOS } from './pesos-bar'
import { DESCRIPCIONES_MODELOS, NOMBRES_MODELOS, ModeloId } from '@/lib/ml/tipos'
import { toast } from 'sonner'
import { RefreshCw, Boxes, Cpu } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

export function ModelosView() {
  const { tipo } = useAppStore()
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const t = montado ? tipo : 'Principal'
  const { data, mutate, isLoading } = useSWR(montado ? `/api/metricas?tipo=${t}` : null, fetcher)
  const [ent, setEnt] = useState(false)

  const modelos = data?.actual ?? []

  async function reentrenar() {
    setEnt(true)
    try {
      const res = await fetch('/api/entrenar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo: t }) })
      const d = await res.json()
      if (d?.ok) { await mutate(); toast.success('Modelos re-evaluados y pesos recalculados') }
      else toast.error(d?.mensaje ?? 'Error')
    } catch { toast.error('Error al re-entrenar') } finally { setEnt(false) }
  }

  const barData = modelos.map((m: any) => ({ nombre: (NOMBRES_MODELOS[m.modelo as ModeloId] ?? m.modelo).split(' ')[0], precision: Number((m.precisionMedia ?? 0).toFixed(2)), peso: Number(((m.peso ?? 0) * 100).toFixed(1)) }))
  const radarData = modelos.map((m: any) => ({ modelo: (NOMBRES_MODELOS[m.modelo as ModeloId] ?? m.modelo).split(' ')[0], hitRate: Number(((m.hitRate ?? 0) * 100).toFixed(1)) }))

  return (
    <div className="space-y-8">
      <PageHeader title="Modelos de IA" description={`Comparación de los 6 algoritmos evaluados para el sorteo ${t}, con sus métricas de error y pesos adaptativos.`}
        actions={<Button onClick={reentrenar} loading={ent}><RefreshCw className="mr-2 h-4 w-4" />Re-evaluar modelos</Button>} />

      {isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : modelos.length === 0 ? (
        <EstadoVacio mensaje="Aún no hay métricas. Re-evalua los modelos para generarlas." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Boxes className="h-4 w-4 text-primary" />Precisión vs peso</CardTitle><CardDescription>Aciertos promedio (0-5) y peso en el ensemble (%)</CardDescription></CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 40 }}>
                      <XAxis dataKey="nombre" tickLine={false} tick={{ fontSize: 10 }} angle={-40} textAnchor="end" height={60} interval={0} />
                      <YAxis tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip wrapperStyle={{ fontSize: 11 }} />
                      <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="precision" name="Precisión" fill="#60B5FF" radius={[4,4,0,0]} />
                      <Bar dataKey="peso" name="Peso %" fill="#A19AD3" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Cpu className="h-4 w-4 text-primary" />Tasa de acierto</CardTitle><CardDescription>Hit-rate por modelo (%)</CardDescription></CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} outerRadius={90}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="modelo" tick={{ fontSize: 9 }} />
                      <PolarRadiusAxis tick={{ fontSize: 9 }} />
                      <Radar name="Hit-rate" dataKey="hitRate" stroke="#FF6363" fill="#FF6363" fillOpacity={0.4} />
                      <Tooltip wrapperStyle={{ fontSize: 11 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Detalle por modelo</CardTitle><CardDescription>Métricas de la última validación walk-forward</CardDescription></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Modelo</TableHead><TableHead>Precisión</TableHead><TableHead>Hit-rate</TableHead><TableHead>MAE</TableHead><TableHead>RMSE</TableHead><TableHead>Peso</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelos.map((m: any) => (
                      <TableRow key={m.modelo}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORES_MODELOS[m.modelo] ?? '#60B5FF' }} />
                            <div><p className="font-medium">{NOMBRES_MODELOS[m.modelo as ModeloId] ?? m.modelo}</p><p className="max-w-md text-[11px] text-muted-foreground">{DESCRIPCIONES_MODELOS[m.modelo as ModeloId]}</p></div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{(m.precisionMedia ?? 0).toFixed(2)}</TableCell>
                        <TableCell className="font-mono">{((m.hitRate ?? 0) * 100).toFixed(1)}%</TableCell>
                        <TableCell className="font-mono">{(m.mae ?? 0).toFixed(2)}</TableCell>
                        <TableCell className="font-mono">{(m.rmse ?? 0).toFixed(2)}</TableCell>
                        <TableCell><Badge variant="secondary" className="font-mono">{((m.peso ?? 0) * 100).toFixed(1)}%</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
