'use client'
import { useState } from 'react'
import { mutate } from 'swr'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { PlusCircle, Brain } from 'lucide-react'

export function IngresoInline() {
  const { tipo } = useAppStore()
  const [fecha, setFecha] = useState('')
  const [nums, setNums] = useState<string[]>(['', '', '', '', ''])
  const [diff, setDiff] = useState('')
  const [enviando, setEnviando] = useState(false)

  function setNum(i: number, v: string) {
    const copia = [...nums]
    copia[i] = v.replace(/[^0-9]/g, '')
    setNums(copia)
  }

  async function enviar() {
    const numeros = nums.map((x) => Number(x))
    if (!fecha) return toast.error('Selecciona la fecha del sorteo')
    if (numeros.some((x) => !x || x < 1 || x > 43))
      return toast.error('Los 5 principales deben estar entre 1 y 43')
    if (new Set(numeros).size !== 5) return toast.error('Los números no pueden repetirse')
    const d = Number(diff)
    if (!d || d < 1 || d > 16) return toast.error('El número diferente debe estar entre 1 y 16')

    setEnviando(true)
    try {
      const res = await fetch('/api/sorteo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, fecha, numeros, diff: d }),
      })
      const data = await res.json()
      if (data?.ok) {
        toast.success(`Sorteo ${tipo} registrado. Sistema re-entrenado automáticamente.`)
        setNums(['', '', '', '', ''])
        setDiff('')
        setFecha('')
        // Refresca la predicción y la tabla de últimos sorteos del panel principal
        await mutate(`/api/prediccion?tipo=${tipo}`)
        await mutate(`/api/sorteos-recientes?limite=30`)
        await mutate(`/api/historial?tipo=${tipo}`)
      } else {
        toast.error(data?.mensaje ?? 'No se pudo registrar')
      }
    } catch {
      toast.error('Error al registrar el sorteo')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-primary" />
          Ingresar sorteo real — {tipo}
        </CardTitle>
        <CardDescription>
          Registra el resultado oficial. El sistema recalibra los modelos y genera una nueva predicción automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="fecha-inline">Fecha</Label>
            <Input
              id="fecha-inline"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-40"
            />
          </div>

          <div className="space-y-2">
            <Label>Principales (1–43)</Label>
            <div className="flex gap-2">
              {nums.map((v, i) => (
                <Input
                  key={i}
                  inputMode="numeric"
                  maxLength={2}
                  value={v}
                  onChange={(e) => setNum(i, e.target.value)}
                  className="h-11 w-11 text-center font-mono"
                  placeholder="–"
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diff-inline">Diferente (1–16)</Label>
            <Input
              id="diff-inline"
              inputMode="numeric"
              maxLength={2}
              value={diff}
              onChange={(e) => setDiff(e.target.value.replace(/[^0-9]/g, ''))}
              className="h-11 w-11 text-center font-mono"
              placeholder="–"
            />
          </div>

          <Button onClick={enviar} loading={enviando} className="ml-auto">
            <Brain className="mr-2 h-4 w-4" />
            Registrar y re-entrenar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
