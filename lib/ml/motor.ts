// Motor de auto-aprendizaje: validación walk-forward, ajuste de hiperparámetros,
// pesos adaptativos, ensemble y detección de cambios de régimen.

import { calcularModelo, normalizar } from './modelos'
import {
  ESPACIO_PARAMS,
  Hiperparams,
  K_PRINCIPALES,
  MAX_DIFF,
  MAX_PRINCIPAL,
  MODELOS,
  ModeloId,
  PARAMS_DEFAULT,
  PerfModelo,
  SorteoLite,
} from './tipos'

export interface EvalModelo {
  modelo: ModeloId
  mae: number
  rmse: number
  precisionMedia: number
  hitRate: number
  muestras: number
  params: Hiperparams
  detallePorSorteo: { fecha: string; predichos: number[]; reales: number[]; aciertos: number }[]
}

function contarAciertos(predichos: number[], reales: number[]): number {
  const set = new Set(reales ?? [])
  return (predichos ?? []).reduce((acc, p) => acc + (set.has(p) ? 1 : 0), 0)
}

export function backtestModelo(
  modelo: ModeloId,
  hist: SorteoLite[],
  params: Hiperparams,
  pasos: number
): EvalModelo {
  const n = hist?.length ?? 0
  const detalle: EvalModelo['detallePorSorteo'] = []
  let sumAbs = 0
  let sumSq = 0
  let sumAciertos = 0
  let count = 0

  // FIX Bug 4: distribuir pasos por todo el historial, no solo el final.
  // Tomar muestras uniformes: 1/3 recientes, 1/3 medios, 1/3 antiguos.
  const pasosRecientes = Math.ceil(pasos * 0.5)
  const pasosAntiguos = pasos - pasosRecientes
  const inicioReciente = Math.max(25, n - pasosRecientes)
  const mitad = Math.floor(n / 2)
  const inicioAntiguo = Math.max(25, mitad - Math.floor(pasosAntiguos / 2))
  const finAntiguo = Math.min(mitad + Math.floor(pasosAntiguos / 2), inicioReciente)

  const indices: number[] = []
  for (let t = inicioAntiguo; t < finAntiguo; t++) indices.push(t)
  for (let t = inicioReciente; t < n; t++) indices.push(t)

  for (const t of indices) {
    const previo = hist.slice(0, t)
    if (previo.length < 20) continue
    const res = calcularModelo(modelo, previo, params)
    const reales = hist[t]?.n ?? []
    const aciertos = contarAciertos(res.topPrincipal, reales)
    const err = K_PRINCIPALES - aciertos
    sumAbs += err
    sumSq += err * err
    sumAciertos += aciertos
    count++
    detalle.push({
      fecha: hist[t]?.fecha ?? '',
      predichos: res.topPrincipal,
      reales,
      aciertos,
    })
  }
  const muestras = Math.max(1, count)
  const mae = sumAbs / muestras
  const rmse = Math.sqrt(sumSq / muestras)
  const precisionMedia = sumAciertos / muestras
  const hitRate = precisionMedia / K_PRINCIPALES
  return { modelo, mae, rmse, precisionMedia, hitRate, muestras: count, params, detallePorSorteo: detalle }
}

function combinaciones(espacio: Record<string, number[]>): Hiperparams[] {
  const claves = Object.keys(espacio ?? {})
  if (claves.length === 0) return [{}]
  let acc: Hiperparams[] = [{}]
  for (const clave of claves) {
    const nuevo: Hiperparams[] = []
    for (const base of acc) {
      for (const val of espacio[clave]) {
        nuevo.push({ ...base, [clave]: val })
      }
    }
    acc = nuevo
  }
  return acc
}

export function ajustarHiperparams(
  modelo: ModeloId,
  hist: SorteoLite[],
  pasos: number
): { params: Hiperparams; eval: EvalModelo; probados: number } {
  const espacio = ESPACIO_PARAMS[modelo] ?? {}
  let combos = combinaciones(espacio)
  if (modelo === 'red_neuronal' && combos.length > 4) combos = combos.slice(0, 4)
  let mejor: EvalModelo | null = null
  let mejorParams: Hiperparams = PARAMS_DEFAULT[modelo]
  for (const params of combos) {
    const ev = backtestModelo(modelo, hist, params, pasos)
    const score = ev.precisionMedia - 0.1 * ev.rmse
    const scoreMejor = mejor ? mejor.precisionMedia - 0.1 * mejor.rmse : -Infinity
    if (!mejor || score > scoreMejor) {
      mejor = ev
      mejorParams = params
    }
  }
  return {
    params: mejorParams,
    eval: mejor ?? backtestModelo(modelo, hist, PARAMS_DEFAULT[modelo], pasos),
    probados: combos.length,
  }
}

export function calcularPesos(perfs: { modelo: ModeloId; precisionMedia: number }[]): Record<string, number> {
  const lista = perfs ?? []
  if (lista.length === 0) return {}

  // FIX Bug 2: aumentar temperatura para amplificar diferencias entre modelos.
  // Temperatura 3.5 hace que el mejor modelo obtenga ~2-3x el peso del peor.
  const temp = 3.5
  const maxP = Math.max(...lista.map((p) => p.precisionMedia))
  const exps = lista.map((p) => Math.exp((p.precisionMedia - maxP) * temp))
  const suma = exps.reduce((a, b) => a + b, 0) || 1
  const out: Record<string, number> = {}
  lista.forEach((p, i) => {
    out[p.modelo] = exps[i] / suma
  })
  return out
}

export function detectarCambioRegimen(hist: SorteoLite[]): {
  cambio: boolean
  divergencia: number
} {
  const n = hist?.length ?? 0
  if (n < 40) return { cambio: false, divergencia: 0 }
  const mitad = Math.floor(n / 2)
  const freq = (desde: number, hasta: number) => {
    const f = new Array(MAX_PRINCIPAL).fill(0)
    let total = 0
    for (let i = desde; i < hasta; i++) {
      ;(hist[i]?.n ?? []).forEach((num) => {
        if (num >= 1 && num <= MAX_PRINCIPAL) { f[num - 1]++; total++ }
      })
    }
    return f.map((x) => (total > 0 ? x / total : 0))
  }
  const antigua = freq(0, mitad)
  const reciente = freq(mitad, n)
  let div = 0
  for (let i = 0; i < MAX_PRINCIPAL; i++) div += Math.abs(reciente[i] - antigua[i])
  const divergencia = div / 2
  return { cambio: divergencia > 0.28, divergencia }
}

export interface ResultadoEnsemble {
  numeros: number[]
  diff: number
  confianza: number
  scoresPorModelo: Record<string, { topPrincipal: number[]; topDiff: number }>
  contribPrincipal: number[]
  modeloLider: ModeloId
}

export function generarEnsemble(
  hist: SorteoLite[],
  pesos: Record<string, number>,
  paramsPorModelo: Record<string, Hiperparams>,
  // FIX Bug 3: recibir lista de números penalizados (fallaron recientemente)
  penalizados: Set<number> = new Set()
): ResultadoEnsemble {
  const combinadoP = new Array(MAX_PRINCIPAL).fill(0)
  const combinadoD = new Array(MAX_DIFF).fill(0)
  const scoresPorModelo: Record<string, { topPrincipal: number[]; topDiff: number }> = {}
  let modeloLider: ModeloId = MODELOS[0]
  let pesoLider = -1

  for (const modelo of MODELOS) {
    const params = paramsPorModelo[modelo] ?? PARAMS_DEFAULT[modelo]
    const peso = pesos[modelo] ?? 1 / MODELOS.length
    if (peso > pesoLider) { pesoLider = peso; modeloLider = modelo }
    const res = calcularModelo(modelo, hist, params)
    scoresPorModelo[modelo] = { topPrincipal: res.topPrincipal, topDiff: res.topDiff }
    for (let i = 0; i < MAX_PRINCIPAL; i++) combinadoP[i] += peso * (res.scoresPrincipal[i] ?? 0)
    for (let i = 0; i < MAX_DIFF; i++) combinadoD[i] += peso * (res.scoresDiff[i] ?? 0)
  }

  // FIX Bug 3: aplicar penalización del 40% a números que fallaron en las
  // últimas 3 predicciones. Esto fuerza rotación real entre predicciones.
  const penaltyFactor = 0.60
  for (const num of penalizados) {
    const idx = num - 1
    if (idx >= 0 && idx < MAX_PRINCIPAL) {
      combinadoP[idx] *= penaltyFactor
    }
  }

  const pNorm = normalizar(combinadoP)
  const idxP = pNorm.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s)
  const numeros = idxP.slice(0, K_PRINCIPALES).map((o) => o.i + 1).sort((a, b) => a - b)
  const idxD = combinadoD.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s)
  const diff = (idxD[0]?.i ?? 0) + 1

  const top5Prom = idxP.slice(0, 5).reduce((a, o) => a + o.s, 0) / 5
  const restoProm = idxP.slice(5).reduce((a, o) => a + o.s, 0) / Math.max(1, idxP.length - 5)
  const confianza = Math.round(Math.min(95, Math.max(35, (top5Prom - restoProm) * 100 + 45)))

  return { numeros, diff, confianza, scoresPorModelo, contribPrincipal: pNorm, modeloLider }
}
