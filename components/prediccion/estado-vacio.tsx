'use client'
import { AlertCircle } from 'lucide-react'

export function EstadoVacio({ mensaje }: { mensaje?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/30 p-10 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{mensaje ?? 'No hay datos que coincidan con el criterio seleccionado.'}</p>
    </div>
  )
}
