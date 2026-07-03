'use client'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { useAppStore } from '@/lib/store'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/layouts/page-header'
import { EstadoVacio } from './estado-vacio'
import { LineChart as LC, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { TrendingUp, BarChart3, Timer } from 'lucide-react'

export function AnalisisView() {
  const { tipo } = useAppStore()
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const t = montado ? tipo : 'Principal'
  const { data, isLoading } = useSWR(montado ? `/api/analisis?tipo=${t}` : null, fetcher)

  const serie = data?.serie ?? []
  const frec = data?.frecuenciaPrincipal ?? []
  const sequia = (data?.sequia ?? []).slice().sort((a: any, b: any) => b.sequia - a.sequia).slice(0, 15)

  return (
    <div className="space-y-8">
      <PageHeader title="Análisis Temporal" description={`Series temporales y estadísticas descriptivas del sorteo ${t} sobre ${data?.total ?? 0} registros históricos.`} />
      {isLoading ? <div className="h-40 animate-pulse rounded-xl bg-muted" /> : (data?.total ?? 0) === 0 ? <EstadoVacio /> : (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4 text-primary" />Evolución de la suma por sorteo</CardTitle><CardDescription>Últimos 60 sorteos · suma y promedio de los 5 principales</CardDescription></CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LC data={serie} margin={{ top: 10, right: 15, left: -10, bottom: 30 }}>
                    <XAxis dataKey="fecha" tickLine={false} tick={{ fontSize: 9 }} interval="preserveStartEnd" angle={-40} textAnchor="end" height={50} />
                    <YAxis tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip wrapperStyle={{ fontSize: 11 }} />
                    <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="suma" name="Suma" stroke="#60B5FF" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="diff" name="Diferente" stroke="#FF9149" strokeWidth={2} dot={false} />
                  </LC>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="h-4 w-4 text-primary" />Frecuencia por número</CardTitle><CardDescription>Apariciones históricas (1–43)</CardDescription></CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={frec} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                      <XAxis dataKey="numero" tickLine={false} tick={{ fontSize: 8 }} interval={2} />
                      <YAxis tickLine={false} tick={{ fontSize: 10 }} />
                      <Tooltip wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="frecuencia" name="Frecuencia" fill="#80D8C3" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Timer className="h-4 w-4 text-primary" />Mayor sequía</CardTitle><CardDescription>Números con más sorteos sin aparecer</CardDescription></CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sequia} layout="vertical" margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
                      <XAxis type="number" tickLine={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="numero" tickLine={false} tick={{ fontSize: 9 }} width={28} />
                      <Tooltip wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="sequia" name="Sequía" fill="#FF90BB" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
