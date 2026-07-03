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

// Cuenta cuántos de los top-5 predichos coinciden con los reales
function contarAciertos(predichos: number[], reales: number[]): number {
  const set = new Set(reales ?? [])
  return (predichos ?? []).reduce((acc, p) => acc + (set.has(p) ? 1 : 0), 0)
}

// Validación walk-forward para un modelo con params dados.
// Recorre los últimos `pasos` sorteos; en cada uno predice con el historial
// previo y compara con el resultado real de ese sorteo.
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
  const inicio = Math.max(25, n - pasos)
  for (let t = inicio; t < n; t++) {
    const previo = hist.slice(0, t)
    if (previo.length < 20) continue
    const res = calcularModelo(modelo, previo, params)
    const reales = hist[t]?.n ?? []
    const aciertos = contarAciertos(res.topPrincipal, reales)
    // "error": números no acertados de 5
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
  return {
    modelo,
    mae,
    rmse,
    precisionMedia,
    hitRate,
    muestras: count,
    params,
    detallePorSorteo: detalle,
  }
}

// Búsqueda de hiperparámetros: prueba combinaciones del espacio y devuelve la
// mejor según precisión media (con penalización por rmse).
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
  // limitar coste de la red neuronal
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

// Convierte precisión de cada modelo en pesos adaptativos vía softmax.
export function calcularPesos(perfs: { modelo: ModeloId; precisionMedia: number }[]): Record<string, number> {
  const lista = perfs ?? []
  if (lista.length === 0) return {}
  const temp = 1.4 // temperatura del softmax
  const maxP = Math.max(...lista.map((p) => p.precisionMedia))
  const exps = lista.map((p) => Math.exp((p.precisionMedia - maxP) * temp))
  const suma = exps.reduce((a, b) => a + b, 0) || 1
  const out: Record<string, number> = {}
  lista.forEach((p, i) => {
    out[p.modelo] = exps[i] / suma
  })
  return out
}

// Detección simple de cambio de régimen: compara la distribución de frecuencias
// de la mitad reciente vs la anterior (distancia L1 normalizada).
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
        if (num >= 1 && num <= MAX_PRINCIPAL) {
          f[num - 1]++
          total++
        }
      })
    }
    return f.map((x) => (total > 0 ? x / total : 0))
  }
  const antigua = freq(0, mitad)
  const reciente = freq(mitad, n)
  let div = 0
  for (let i = 0; i < MAX_PRINCIPAL; i++) div += Math.abs(reciente[i] - antigua[i])
  const divergencia = div / 2 // 0..1
  return { cambio: divergencia > 0.28, divergencia }
}

// Ensemble: combina scores normalizados de todos los modelos ponderados.
export interface ResultadoEnsemble {
  numeros: number[]
  diff: number
  confianza: number
  scoresPorModelo: Record<string, { topPrincipal: number[]; topDiff: number }>
  contribPrincipal: number[] // score combinado por número
  modeloLider: ModeloId
}

export function generarEnsemble(
  hist: SorteoLite[],
  pesos: Record<string, number>,
  paramsPorModelo: Record<string, Hiperparams>
): ResultadoEnsemble {
  const combinadoP = new Array(MAX_PRINCIPAL).fill(0)
  const combinadoD = new Array(MAX_DIFF).fill(0)
  const scoresPorModelo: Record<string, { topPrincipal: number[]; topDiff: number }> = {}
  let modeloLider: ModeloId = MODELOS[0]
  let pesoLider = -1

  for (const modelo of MODELOS) {
    const params = paramsPorModelo[modelo] ?? PARAMS_DEFAULT[modelo]
    const peso = pesos[modelo] ?? 1 / MODELOS.length
    if (peso > pesoLider) {
      pesoLider = peso
      modeloLider = modelo
    }
    const res = calcularModelo(modelo, hist, params)
    scoresPorModelo[modelo] = { topPrincipal: res.topPrincipal, topDiff: res.topDiff }
    for (let i = 0; i < MAX_PRINCIPAL; i++) combinadoP[i] += peso * (res.scoresPrincipal[i] ?? 0)
    for (let i = 0; i < MAX_DIFF; i++) combinadoD[i] += peso * (res.scoresDiff[i] ?? 0)
  }

  const pNorm = normalizar(combinadoP)
  const idxP = pNorm.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s)
  const numeros = idxP.slice(0, K_PRINCIPALES).map((o) => o.i + 1).sort((a, b) => a - b)
  const idxD = combinadoD.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s)
  const diff = (idxD[0]?.i ?? 0) + 1

  // confianza: separación entre el top-5 y el resto + concentración
  const top5Prom = idxP.slice(0, 5).reduce((a, o) => a + o.s, 0) / 5
  const restoProm =
    idxP.slice(5).reduce((a, o) => a + o.s, 0) / Math.max(1, idxP.length - 5)
  const confianza = Math.round(Math.min(95, Math.max(35, (top5Prom - restoProm) * 100 + 45)))

  return {
    numeros,
    diff,
    confianza,
    scoresPorModelo,
    contribPrincipal: pNorm,
    modeloLider,
  }
}
