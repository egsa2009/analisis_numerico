'use client'
import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { useAppStore } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/layouts/page-header'
import { NumberBall } from './number-ball'
import { SorteosRecientes } from './sorteos-recientes'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { PlusCircle, CheckCircle2, Brain, Sparkles, ArrowRight, Dices, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

export function FormIngreso() {
  const { tipo, setTipo } = useAppStore()
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  const tActual = montado ? tipo : 'Principal'

  const { data: pred, mutate: mutarPred } = useSWR(
    montado ? `/api/prediccion?tipo=${tActual}` : null,
    fetcher
  )
  const { mutate: mutarRecientes } = useSWR(
    montado ? `/api/sorteos-recientes?limite=20` : null,
    fetcher
  )

  const [fecha, setFecha] = useState('')
  const [nums, setNums] = useState<string[]>(['', '', '', '', ''])
  const [diff, setDiff] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<any>(null)

  const prediccionActiva = pred?.prediccion ?? null

  // Limpiar resultado cuando cambia el tipo
  useEffect(() => { setResultado(null) }, [tActual])

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
    setResultado(null)
    try {
      const res = await fetch('/api/sorteo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: tActual, fecha, numeros, diff: d }),
      })
      const data = await res.json()
      if (data?.ok) {
        setResultado(data)
        toast.success(`Sorteo ${tActual} registrado. Sistema re-entrenado automáticamente.`)
        setNums(['', '', '', '', ''])
        setDiff('')
        setFecha('')
        await mutarPred()
        await mutarRecientes()
      } else {
        toast.error(data?.mensaje ?? 'No se pudo registrar')
      }
    } catch {
      toast.error('Error al registrar el sorteo')
    } finally {
      setEnviando(false)
    }
  }

  const evalPrev = resultado?.evaluadas ?? 0
  const nuevaPred = resultado?.prediccion?.prediccion ?? null

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ingresar Sorteo Real"
        description="Registra el resultado oficial. El sistema comparará con su predicción, recalibrará los modelos y generará una nueva predicción automáticamente."
      />

      {/* Selector de tipo destacado */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-4 py-4">
          <span className="text-sm font-medium text-muted-foreground">Tipo de sorteo:</span>
          <div className="flex items-center gap-2 rounded-full border bg-background p-1 shadow-sm">
            {(['Principal', 'Secundario'] as const).map((t) => {
              const activo = tActual === t
              const Icon = t === 'Principal' ? Dices : Layers
              return (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={cn(
                    'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-150',
                    activo
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t}
                </button>
              )
            })}
          </div>
          <span className="text-xs text-muted-foreground">
            (también puedes cambiarlo desde el header)
          </span>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-primary" />
              Nuevo resultado — {tActual}
            </CardTitle>
            <CardDescription>
              Principales 1–43 (5 distintos) + número diferente 1–16
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha del sorteo</Label>
              <Input
                id="fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Números principales (1–43)</Label>
              <div className="flex flex-wrap gap-3">
                {nums.map((v, i) => (
                  <Input
                    key={i}
                    inputMode="numeric"
                    maxLength={2}
                    value={v}
                    onChange={(e) => setNum(i, e.target.value)}
                    className="h-14 w-14 text-center font-mono text-lg"
                    placeholder="–"
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="diff">Número diferente (1–16)</Label>
              <Input
                id="diff"
                inputMode="numeric"
                maxLength={2}
                value={diff}
                onChange={(e) => setDiff(e.target.value.replace(/[^0-9]/g, ''))}
                className="h-14 w-14 text-center font-mono text-lg"
                placeholder="–"
              />
            </div>
            <Button onClick={enviar} loading={enviando} size="lg" className="w-full">
              <Brain className="mr-2 h-4 w-4" />
              Registrar y re-entrenar ({tActual})
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Predicción vigente — {tActual}</CardTitle>
              <CardDescription>Se comparará con lo que ingreses</CardDescription>
            </CardHeader>
            <CardContent>
              {prediccionActiva?.numeros?.length ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {prediccionActiva.numeros.map((n: number) => (
                      <NumberBall key={n} n={n} size="sm" />
                    ))}
                    <span className="text-muted-foreground">+</span>
                    <NumberBall n={prediccionActiva.diff} variant="diff" size="sm" />
                  </div>
                  {prediccionActiva.ultimoSorteo && (
                    <p className="text-xs text-muted-foreground">
                      Basada en datos hasta: <strong>{prediccionActiva.ultimoSorteo}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin predicción previa.</p>
              )}
            </CardContent>
          </Card>

          {/* Últimos sorteos del tipo activo */}
          <SorteosRecientes tipo={tActual} limite={8} mostrarTipo={false} />
        </div>
      </div>

      {/* Resultado del ciclo de aprendizaje */}
      <AnimatePresence>
        {resultado?.ok && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card className="border-emerald-500/40 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" /> Ciclo de auto-aprendizaje ejecutado
                </CardTitle>
                <CardDescription>
                  {evalPrev > 0
                    ? `${evalPrev} predicción(es) previa(s) evaluada(s), modelos recalibrados y nueva predicción generada.`
                    : 'Modelos recalibrados y nueva predicción generada.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Nueva predicción ({tActual}):</span>
                  {(nuevaPred?.numeros ?? []).map((n: number) => (
                    <NumberBall key={n} n={n} size="sm" />
                  ))}
                  {nuevaPred?.diff != null && (
                    <>
                      <span className="text-muted-foreground">+</span>
                      <NumberBall n={nuevaPred?.diff} variant="diff" size="sm" />
                    </>
                  )}
                </div>
                {nuevaPred?.explicacion && (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {nuevaPred.explicacion}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabla combinada de ambos tipos */}
      <SorteosRecientes limite={30} mostrarTipo={true} />
    </div>
  )
}
