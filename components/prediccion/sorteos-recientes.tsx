'use client'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { NumberBall } from './number-ball'
import { EstadoVacio } from './estado-vacio'
import { RefreshCw, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  /** Si se pasa, filtra por ese tipo. Si no, muestra ambos combinados */
  tipo?: 'Principal' | 'Secundario'
  limite?: number
  /** Mostrar columna de tipo (útil cuando se muestran ambos) */
  mostrarTipo?: boolean
  className?: string
}

export function SorteosRecientes({ tipo, limite = 20, mostrarTipo = true, className }: Props) {
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])

  const url = montado
    ? `/api/sorteos-recientes?limite=${limite}${tipo ? `&tipo=${tipo}` : ''}`
    : null

  const { data, isLoading, mutate } = useSWR(url, fetcher)
  const sorteos = data?.sorteos ?? []

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-primary" />
            Últimos sorteos
          </CardTitle>
          {data && (
            <CardDescription className="mt-1">
              {tipo
                ? `${data.totalPrincipal + data.totalSecundario > 0 ? (tipo === 'Principal' ? data.totalPrincipal : data.totalSecundario) : 0} registros · ${tipo}`
                : `${data.totalPrincipal ?? 0} Principal · ${data.totalSecundario ?? 0} Secundario`}
            </CardDescription>
          )}
        </div>
        <Button size="icon" variant="ghost" onClick={() => mutate()} title="Recargar">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-2 px-6 pb-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : sorteos.length === 0 ? (
          <div className="px-6 pb-4">
            <EstadoVacio mensaje="Sin sorteos registrados todavía." />
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Fecha</th>
                  {mostrarTipo && <th className="px-4 py-2 text-left font-medium">Tipo</th>}
                  <th className="px-4 py-2 text-left font-medium">Números</th>
                  <th className="px-4 py-2 text-center font-medium">Diff</th>
                </tr>
              </thead>
              <tbody>
                {sorteos.map((s: any, idx: number) => (
                  <tr
                    key={s.id}
                    className={cn(
                      'border-b transition-colors last:border-0 hover:bg-muted/40',
                      idx === 0 && 'bg-primary/5'
                    )}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                      {s.fecha}
                      {idx === 0 && (
                        <span className="ml-2 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          Último
                        </span>
                      )}
                    </td>
                    {mostrarTipo && (
                      <td className="px-4 py-2.5">
                        <Badge
                          variant={s.tipo === 'Principal' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {s.tipo}
                        </Badge>
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {(s.numeros ?? []).map((n: number) => (
                          <NumberBall key={n} n={n} size="sm" />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <NumberBall n={s.diff} variant="diff" size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
