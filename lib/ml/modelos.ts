// Modelos de predicción (TypeScript puro). Cada modelo produce un vector de
// scores sobre el dominio (1..MAX). El motor de ensemble combina estos scores.

import {
  Hiperparams,
  MAX_DIFF,
  MAX_PRINCIPAL,
  ModeloId,
  ScoreModelo,
  SorteoLite,
} from './tipos'

function ceros(n: number): number[] {
  return new Array(n).fill(0)
}

export function normalizar(v: number[]): number[] {
  const arr = v ?? []
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const rango = max - min
  if (!isFinite(rango) || rango <= 1e-9) return arr.map(() => 0.5)
  return arr.map((x) => (x - min) / rango)
}

function topKIdx(scores: number[], k: number): number[] {
  const idx = (scores ?? []).map((s, i) => ({ s, i }))
  idx.sort((a, b) => b.s - a.s)
  return idx.slice(0, k).map((o) => o.i + 1)
}

// ---------- 1) Frecuencia Adaptativa (decaimiento exponencial) ----------
function frecuenciaAdaptativa(hist: SorteoLite[], params: Hiperparams): { p: number[]; d: number[] } {
  const decay = params?.decaimiento ?? 0.97
  const p = ceros(MAX_PRINCIPAL)
  const d = ceros(MAX_DIFF)
  const n = hist?.length ?? 0
  for (let i = 0; i < n; i++) {
    const antiguedad = n - 1 - i
    const peso = Math.pow(decay, antiguedad)
    const s = hist[i]
    ;(s?.n ?? []).forEach((num) => {
      if (num >= 1 && num <= MAX_PRINCIPAL) p[num - 1] += peso
    })
    if (s?.diff >= 1 && s?.diff <= MAX_DIFF) d[s.diff - 1] += peso
  }
  return { p, d }
}

// ---------- 2) Promedio Móvil Ponderado ----------
function promedioMovil(hist: SorteoLite[], params: Hiperparams): { p: number[]; d: number[] } {
  const ventana = Math.max(5, Math.round(params?.ventana ?? 30))
  const sesgo = params?.sesgo ?? 1.5
  const p = ceros(MAX_PRINCIPAL)
  const d = ceros(MAX_DIFF)
  const n = hist?.length ?? 0
  const desde = Math.max(0, n - ventana)
  for (let i = desde; i < n; i++) {
    const pos = i - desde
    const peso = Math.pow((pos + 1) / (n - desde), sesgo)
    const s = hist[i]
    ;(s?.n ?? []).forEach((num) => {
      if (num >= 1 && num <= MAX_PRINCIPAL) p[num - 1] += peso
    })
    if (s?.diff >= 1 && s?.diff <= MAX_DIFF) d[s.diff - 1] += peso
  }
  return { p, d }
}

// ---------- 3) Regresión Lineal sobre frecuencia por bloques ----------
function regresionLineal(hist: SorteoLite[], params: Hiperparams): { p: number[]; d: number[] } {
  const bloques = Math.max(3, Math.round(params?.bloques ?? 6))
  const n = hist?.length ?? 0
  const p = ceros(MAX_PRINCIPAL)
  const d = ceros(MAX_DIFF)
  if (n < bloques) return frecuenciaAdaptativa(hist, { decaimiento: 0.97 })
  const tamBloque = Math.floor(n / bloques)
  const proyectar = (getFreqBloque: (b: number) => number): number => {
    const xs: number[] = []
    const ys: number[] = []
    for (let b = 0; b < bloques; b++) { xs.push(b); ys.push(getFreqBloque(b)) }
    const m = xs.length
    const sx = xs.reduce((a, b) => a + b, 0)
    const sy = ys.reduce((a, b) => a + b, 0)
    const sxy = xs.reduce((a, x, i) => a + x * ys[i], 0)
    const sxx = xs.reduce((a, x) => a + x * x, 0)
    const den = m * sxx - sx * sx
    const pend = den === 0 ? 0 : (m * sxy - sx * sy) / den
    const inter = (sy - pend * sx) / m
    return Math.max(0, inter + pend * bloques)
  }
  for (let num = 1; num <= MAX_PRINCIPAL; num++) {
    p[num - 1] = proyectar((b) => {
      let c = 0
      const ini = b * tamBloque
      const fin = b === bloques - 1 ? n : ini + tamBloque
      for (let i = ini; i < fin; i++) if ((hist[i]?.n ?? []).includes(num)) c++
      return c
    })
  }
  for (let num = 1; num <= MAX_DIFF; num++) {
    d[num - 1] = proyectar((b) => {
      let c = 0
      const ini = b * tamBloque
      const fin = b === bloques - 1 ? n : ini + tamBloque
      for (let i = ini; i < fin; i++) if (hist[i]?.diff === num) c++
      return c
    })
  }
  return { p, d }
}

// ---------- 4) Patrones Temporales Dinámicos (sequía / intervalos) ----------
function patronesTemporales(hist: SorteoLite[], params: Hiperparams): { p: number[]; d: number[] } {
  const sens = params?.sensibilidad ?? 1.0
  const n = hist?.length ?? 0
  const p = ceros(MAX_PRINCIPAL)
  const d = ceros(MAX_DIFF)
  const calc = (max: number, contiene: (i: number, num: number) => boolean) => {
    const out = ceros(max)
    for (let num = 1; num <= max; num++) {
      let sequia = 0
      for (let i = n - 1; i >= 0; i--) { if (contiene(i, num)) break; sequia++ }
      const posiciones: number[] = []
      for (let i = 0; i < n; i++) if (contiene(i, num)) posiciones.push(i)
      let intervalo = n
      if (posiciones.length > 1) {
        let suma = 0
        for (let k = 1; k < posiciones.length; k++) suma += posiciones[k] - posiciones[k - 1]
        intervalo = suma / (posiciones.length - 1)
      }
      const ratio = intervalo > 0 ? sequia / intervalo : 0
      out[num - 1] = Math.pow(Math.max(0.01, ratio), sens)
    }
    return out
  }
  const pp = calc(MAX_PRINCIPAL, (i, num) => (hist[i]?.n ?? []).includes(num))
  const dd = calc(MAX_DIFF, (i, num) => hist[i]?.diff === num)
  for (let i = 0; i < MAX_PRINCIPAL; i++) p[i] = pp[i]
  for (let i = 0; i < MAX_DIFF; i++) d[i] = dd[i]
  return { p, d }
}

// ---------- 5) Análisis de Coocurrencia ----------
function coocurrencia(hist: SorteoLite[], params: Hiperparams): { p: number[]; d: number[] } {
  const prof = Math.max(10, Math.round(params?.profundidad ?? 40))
  const n = hist?.length ?? 0
  const p = ceros(MAX_PRINCIPAL)
  const d = ceros(MAX_DIFF)

  // FIX Bug 1: usar los últimos K sorteos como "contexto" en lugar de solo
  // el último. Así el modelo no queda atrapado en el eco del sorteo más reciente.
  // Usar los últimos 3 sorteos como contexto de coocurrencia.
  const CONTEXTO = 3
  const ultimos = hist.slice(Math.max(0, n - CONTEXTO))
  const contextoNums = new Set<number>()
  ultimos.forEach((s) => (s?.n ?? []).forEach((x) => contextoNums.add(x)))

  const desde = Math.max(0, n - prof)
  const co: number[][] = Array.from({ length: MAX_PRINCIPAL }, () => ceros(MAX_PRINCIPAL))
  for (let i = desde; i < n; i++) {
    const nums = hist[i]?.n ?? []
    for (let a = 0; a < nums.length; a++) {
      for (let b = 0; b < nums.length; b++) {
        if (a === b) continue
        const x = nums[a] - 1
        const y = nums[b] - 1
        if (x >= 0 && x < MAX_PRINCIPAL && y >= 0 && y < MAX_PRINCIPAL) co[x][y]++
      }
    }
  }

  // FIX Bug 1 cont: puntuar por coocurrencia con el CONTEXTO (últimos 3),
  // pero también agregar un componente de "coocurrencia negativa" para
  // penalizar números que coocurren con sí mismos (ya salieron).
  for (let num = 1; num <= MAX_PRINCIPAL; num++) {
    let s = 0
    contextoNums.forEach((u) => {
      if (u >= 1 && u <= MAX_PRINCIPAL) s += co[u - 1][num - 1]
    })
    // Penalizar si el número ya está en el contexto (ya salió recientemente)
    if (contextoNums.has(num)) s *= 0.3
    p[num - 1] = s
  }

  for (let i = desde; i < n; i++) {
    const df = hist[i]?.diff
    if (df >= 1 && df <= MAX_DIFF) d[df - 1]++
  }
  return { p, d }
}

// ---------- 6) Red Neuronal Simple (MLP en TS puro) ----------
function rasgosEn(
  hist: SorteoLite[],
  hasta: number,
  max: number,
  contiene: (i: number, num: number) => boolean
): number[][] {
  const ventana = Math.min(hasta, 30)
  const out: number[][] = []
  for (let num = 1; num <= max; num++) {
    let freq = 0
    for (let i = hasta - ventana; i < hasta; i++) if (i >= 0 && contiene(i, num)) freq++
    let sequia = 0
    for (let i = hasta - 1; i >= 0; i--) { if (contiene(i, num)) break; sequia++ }
    let mitad = 0
    const h = Math.floor(ventana / 2)
    for (let i = hasta - h; i < hasta; i++) if (i >= 0 && contiene(i, num)) mitad++
    const tendencia = mitad - (freq - mitad)
    out.push([freq / ventana, Math.min(1, sequia / 20), (tendencia + h) / (2 * h + 1)])
  }
  return out
}

function sigmoid(x: number): number { return 1 / (1 + Math.exp(-x)) }

function redNeuronal(
  hist: SorteoLite[],
  params: Hiperparams,
  max: number,
  contiene: (i: number, num: number) => boolean
): number[] {
  const epochs = Math.max(20, Math.round(params?.epochs ?? 120))
  const lr = params?.lr ?? 0.05
  const oculta = Math.max(3, Math.round(params?.oculta ?? 8))
  const nFeat = 3
  const n = hist?.length ?? 0
  const rnd = () => (Math.sin((max * 97 + oculta * 13) * (Math.random() + 1)) * 0.5)
  let W1 = Array.from({ length: oculta }, () => Array.from({ length: nFeat }, () => (Math.random() - 0.5) * 0.5))
  let b1 = ceros(oculta)
  let W2 = Array.from({ length: oculta }, () => (Math.random() - 0.5) * 0.5)
  let b2 = 0
  void rnd
  const X: number[][] = []
  const Y: number[] = []
  const inicio = Math.max(20, Math.floor(n * 0.1))
  for (let t = inicio; t < n; t++) {
    const rasgos = rasgosEn(hist, t, max, contiene)
    for (let num = 1; num <= max; num++) {
      X.push(rasgos[num - 1])
      Y.push(contiene(t, num) ? 1 : 0)
    }
  }
  if (X.length === 0) return ceros(max).map(() => 0.5)
  for (let e = 0; e < epochs; e++) {
    for (let s = 0; s < X.length; s++) {
      const x = X[s]
      const h: number[] = ceros(oculta)
      for (let j = 0; j < oculta; j++) {
        let z = b1[j]
        for (let k = 0; k < nFeat; k++) z += W1[j][k] * x[k]
        h[j] = Math.tanh(z)
      }
      let zo = b2
      for (let j = 0; j < oculta; j++) zo += W2[j] * h[j]
      const yhat = sigmoid(zo)
      const err = yhat - Y[s]
      for (let j = 0; j < oculta; j++) {
        const grad = err * W2[j] * (1 - h[j] * h[j])
        for (let k = 0; k < nFeat; k++) W1[j][k] -= lr * grad * x[k]
        b1[j] -= lr * grad
        W2[j] -= lr * err * h[j]
      }
      b2 -= lr * err
    }
  }
  const rasgosAhora = rasgosEn(hist, n, max, contiene)
  const out = ceros(max)
  for (let num = 1; num <= max; num++) {
    const x = rasgosAhora[num - 1]
    const h: number[] = ceros(oculta)
    for (let j = 0; j < oculta; j++) {
      let z = b1[j]
      for (let k = 0; k < nFeat; k++) z += W1[j][k] * x[k]
      h[j] = Math.tanh(z)
    }
    let zo = b2
    for (let j = 0; j < oculta; j++) zo += W2[j] * h[j]
    out[num - 1] = sigmoid(zo)
  }
  return out
}

export function calcularModelo(modelo: ModeloId, hist: SorteoLite[], params: Hiperparams): ScoreModelo {
  let p: number[] = ceros(MAX_PRINCIPAL)
  let d: number[] = ceros(MAX_DIFF)
  const safeHist = hist ?? []
  switch (modelo) {
    case 'frecuencia_adaptativa': { const r = frecuenciaAdaptativa(safeHist, params); p = r.p; d = r.d; break }
    case 'promedio_movil': { const r = promedioMovil(safeHist, params); p = r.p; d = r.d; break }
    case 'regresion_lineal': { const r = regresionLineal(safeHist, params); p = r.p; d = r.d; break }
    case 'patrones_temporales': { const r = patronesTemporales(safeHist, params); p = r.p; d = r.d; break }
    case 'coocurrencia': { const r = coocurrencia(safeHist, params); p = r.p; d = r.d; break }
    case 'red_neuronal': {
      p = redNeuronal(safeHist, params, MAX_PRINCIPAL, (i, num) => (safeHist[i]?.n ?? []).includes(num))
      d = redNeuronal(safeHist, params, MAX_DIFF, (i, num) => safeHist[i]?.diff === num)
      break
    }
  }
  const pNorm = normalizar(p)
  const dNorm = normalizar(d)
  return { modelo, scoresPrincipal: pNorm, scoresDiff: dNorm, topPrincipal: topKIdx(pNorm, 5), topDiff: topKIdx(dNorm, 1)[0] ?? 1 }
}
