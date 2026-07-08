// Capa de servicio: conecta la base de datos con el motor de ML.
import { prisma } from '@/lib/db'
import { fechaISO } from '@/lib/serial'
import {
  ajustarHiperparams,
  backtestModelo,
  calcularPesos,
  detectarCambioRegimen,
  generarEnsemble,
} from './motor'
import {
  Hiperparams,
  MODELOS,
  ModeloId,
  NOMBRES_MODELOS,
  PARAMS_DEFAULT,
  SorteoLite,
  TipoSorteo,
} from './tipos'

const PASOS_BACKTEST = 30

export async function getHistorial(tipo: TipoSorteo): Promise<SorteoLite[]> {
  const filas = await prisma.sorteo.findMany({ where: { tipo }, orderBy: { fecha: 'asc' } })
  return (filas ?? []).map((s) => ({
    fecha: fechaISO(s.fecha),
    n: [s.n1, s.n2, s.n3, s.n4, s.n5],
    diff: s.diff,
  }))
}

async function getParams(tipo: TipoSorteo): Promise<Record<string, Hiperparams>> {
  const filas = await prisma.parametrosModelo.findMany({ where: { tipo, activo: true } })
  const out: Record<string, Hiperparams> = {}
  for (const m of MODELOS) out[m] = PARAMS_DEFAULT[m]
  for (const f of filas ?? []) {
    out[f.modelo] = (f.params as Hiperparams) ?? PARAMS_DEFAULT[f.modelo as ModeloId]
  }
  return out
}

async function getPesos(tipo: TipoSorteo): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const m of MODELOS) {
    const perf = await prisma.modeloPerformance.findFirst({
      where: { tipo, modelo: m },
      orderBy: { evaluadoEn: 'desc' },
    })
    if (perf) out[m] = perf.peso
  }
  if (Object.keys(out).length === 0) {
    for (const m of MODELOS) out[m] = 1 / MODELOS.length
  }
  return out
}

// FIX Bug 3: obtener números que fallaron en las últimas N predicciones
// para pasarlos como penalizados al ensemble.
async function getPenalizados(tipo: TipoSorteo, ultimas: number = 3): Promise<Set<number>> {
  const penalizados = new Set<number>()
  const recientes = await prisma.prediccion.findMany({
    where: { tipo, evaluada: true },
    orderBy: { generadaEn: 'desc' },
    take: ultimas,
  })
  for (const p of recientes ?? []) {
    const reales = new Set(p.reales ?? [])
    ;(p.numeros ?? []).forEach((n: number) => {
      // Solo penalizar si falló (no estaba en el resultado real)
      if (!reales.has(n)) penalizados.add(n)
    })
  }
  return penalizados
}

export async function entrenar(tipo: TipoSorteo) {
  const hist = await getHistorial(tipo)
  if ((hist?.length ?? 0) < 30) {
    return { ok: false, mensaje: 'Se necesitan al menos 30 sorteos para entrenar.' }
  }

  const regimen = detectarCambioRegimen(hist)
  const evaluaciones = []
  const paramsGuardar: Record<string, Hiperparams> = {}

  for (const modelo of MODELOS) {
    const { params, eval: ev, probados } = ajustarHiperparams(modelo, hist, PASOS_BACKTEST)
    paramsGuardar[modelo] = params
    evaluaciones.push({ modelo, params, ev, probados })
  }

  const pesos = calcularPesos(
    evaluaciones.map((e) => ({ modelo: e.modelo, precisionMedia: e.ev.precisionMedia }))
  )

  for (const e of evaluaciones) {
    await prisma.parametrosModelo.upsert({
      where: { uq_tipo_modelo: { tipo, modelo: e.modelo } },
      create: { tipo, modelo: e.modelo, params: e.params, activo: true },
      update: { params: e.params, activo: true },
    })
    await prisma.modeloPerformance.create({
      data: {
        tipo, modelo: e.modelo, mae: e.ev.mae, rmse: e.ev.rmse,
        precisionMedia: e.ev.precisionMedia, hitRate: e.ev.hitRate,
        muestras: e.ev.muestras, peso: pesos[e.modelo] ?? 0, params: e.params,
      },
    })
    for (const d of (e.ev.detallePorSorteo ?? []).slice(-PASOS_BACKTEST)) {
      try {
        await prisma.resultadoValidacion.create({
          data: { tipo, modelo: e.modelo, fechaSorteo: new Date(d.fecha), predichos: d.predichos, reales: d.reales, aciertos: d.aciertos },
        })
      } catch { /* ignora fechas inválidas */ }
    }
  }

  const mejor = [...evaluaciones].sort((a, b) => b.ev.precisionMedia - a.ev.precisionMedia)[0]
  const detalle =
    `Se evaluaron ${MODELOS.length} modelos mediante validación walk-forward sobre los últimos ` +
    `${PASOS_BACKTEST} sorteos. El mejor modelo fue ${NOMBRES_MODELOS[mejor.modelo]} ` +
    `con ${mejor.ev.precisionMedia.toFixed(2)} aciertos promedio (hit-rate ${(mejor.ev.hitRate * 100).toFixed(1)}%). ` +
    (regimen.cambio
      ? `Se detectó un cambio de régimen (divergencia ${(regimen.divergencia * 100).toFixed(0)}%): se prioriza información reciente.`
      : `La serie se mantiene estable (divergencia ${(regimen.divergencia * 100).toFixed(0)}%).`)

  await prisma.logAprendizaje.create({
    data: {
      tipo, evento: 'entrenamiento', titulo: `Re-entrenamiento completado (${tipo})`,
      detalle, data: { pesos, regimen, evaluaciones: evaluaciones.map((e) => ({ modelo: e.modelo, precisionMedia: e.ev.precisionMedia, hitRate: e.ev.hitRate, mae: e.ev.mae, rmse: e.ev.rmse, params: e.params, probados: e.probados })) },
    },
  })

  if (regimen.cambio) {
    await prisma.logAprendizaje.create({
      data: {
        tipo, evento: 'cambio_regimen', titulo: `Cambio de régimen detectado (${tipo})`,
        detalle: `La distribución reciente diverge ${(regimen.divergencia * 100).toFixed(0)}% respecto al histórico. El sistema aumenta el peso de los modelos que reaccionan a datos recientes.`,
        data: regimen,
      },
    })
  }

  return { ok: true, pesos, regimen, evaluaciones: evaluaciones.map((e) => ({ ...e.ev, modelo: e.modelo })) }
}

export async function predecir(tipo: TipoSorteo) {
  const hist = await getHistorial(tipo)
  if ((hist?.length ?? 0) < 25) {
    return { ok: false, mensaje: 'Se necesitan al menos 25 sorteos para predecir.' }
  }
  const params = await getParams(tipo)
  const pesos = await getPesos(tipo)

  // FIX Bug 3: pasar penalizados al ensemble
  const penalizados = await getPenalizados(tipo, 3)

  const ensemble = generarEnsemble(hist, pesos, params, penalizados)
  const ultimoSorteo = hist[hist.length - 1]?.fecha ?? ''

  const penalizadosStr = penalizados.size > 0
    ? ` Se aplicó penalización del 40% a ${penalizados.size} números que fallaron en predicciones recientes: [${[...penalizados].sort((a,b)=>a-b).join(', ')}].`
    : ''

  const pesosOrden = Object.entries(pesos).sort((a, b) => b[1] - a[1])
  const explicacion =
    `Predicción combinada (ensemble) de ${MODELOS.length} modelos. ` +
    `Modelo líder: ${NOMBRES_MODELOS[ensemble.modeloLider]} (${((pesos[ensemble.modeloLider] ?? 0) * 100).toFixed(0)}% del peso). ` +
    `Distribución de pesos: ${pesosOrden.map(([m, w]) => `${NOMBRES_MODELOS[m as ModeloId]} ${(w * 100).toFixed(0)}%`).join(', ')}. ` +
    `Los números ${ensemble.numeros.join(', ')} obtuvieron el mayor score combinado; ` +
    `el número diferente ${ensemble.diff} lidera su categoría. Confianza estimada ${ensemble.confianza}%.` +
    penalizadosStr

  let guardada = null
  try {
    guardada = await prisma.prediccion.create({
      data: {
        tipo, ultimoSorteo: new Date(ultimoSorteo),
        numeros: ensemble.numeros, diffNum: ensemble.diff,
        modeloLider: ensemble.modeloLider, confianza: ensemble.confianza,
        pesos, scoresPorModelo: ensemble.scoresPorModelo, explicacion,
      },
    })
  } catch (e) {
    // ya existe predicción para esta fecha
  }

  await prisma.logAprendizaje.create({
    data: {
      tipo, evento: 'prediccion', titulo: `Nueva predicción generada (${tipo})`,
      detalle: explicacion,
      data: { numeros: ensemble.numeros, diff: ensemble.diff, confianza: ensemble.confianza, pesos, penalizados: [...penalizados] },
    },
  })

  return {
    ok: true,
    prediccion: {
      id: guardada ? Number(guardada.id) : null,
      tipo, ultimoSorteo,
      numeros: ensemble.numeros, diff: ensemble.diff,
      modeloLider: ensemble.modeloLider, confianza: ensemble.confianza,
      pesos, scoresPorModelo: ensemble.scoresPorModelo,
      contribPrincipal: ensemble.contribPrincipal, explicacion,
    },
  }
}

export async function evaluarPendientes(tipo: TipoSorteo) {
  const pendientes = await prisma.prediccion.findMany({ where: { tipo, evaluada: false } })
  let evaluadas = 0
  for (const p of pendientes ?? []) {
    const siguiente = await prisma.sorteo.findFirst({
      where: { tipo, fecha: { gt: p.ultimoSorteo } },
      orderBy: { fecha: 'asc' },
    })
    if (!siguiente) continue
    const reales = [siguiente.n1, siguiente.n2, siguiente.n3, siguiente.n4, siguiente.n5]
    const set = new Set(reales)
    const aciertos = (p.numeros ?? []).reduce((a, x) => a + (set.has(x) ? 1 : 0), 0)
    const diffAcertado = p.diffNum === siguiente.diff
    await prisma.prediccion.update({
      where: { id: p.id },
      data: { resultadoFecha: siguiente.fecha, reales, rDiff: siguiente.diff, aciertos, diffAcertado, evaluada: true },
    })
    await prisma.logAprendizaje.create({
      data: {
        tipo, evento: 'evaluacion', titulo: `Predicción evaluada (${tipo})`,
        detalle: `La predicción [${(p.numeros ?? []).join(', ')}] se comparó con el sorteo real [${reales.join(', ')}] del ${fechaISO(siguiente.fecha)}: ${aciertos}/5 aciertos${diffAcertado ? ' + número diferente acertado' : ''}. El sistema usará este resultado para recalibrar los pesos de los modelos.`,
        data: { predichos: p.numeros, reales, aciertos, diffAcertado, modeloLider: p.modeloLider },
      },
    })
    evaluadas++
  }
  return evaluadas
}

export async function agregarSorteo(input: { fecha: string; tipo: TipoSorteo; n: number[]; diff: number }) {
  const { fecha, tipo, n, diff } = input
  const nums = (n ?? []).map((x) => Number(x))
  if (nums.length !== 5 || new Set(nums).size !== 5) {
    return { ok: false, mensaje: 'Debes ingresar 5 números principales distintos.' }
  }
  if (nums.some((x) => x < 1 || x > 43) || diff < 1 || diff > 16) {
    return { ok: false, mensaje: 'Rango inválido: principales 1-43, diferente 1-16.' }
  }
  const [n1, n2, n3, n4, n5] = [...nums].sort((a, b) => a - b)
  try {
    await prisma.sorteo.create({ data: { fecha: new Date(fecha), tipo, n1, n2, n3, n4, n5, diff } })
  } catch (e) {
    return { ok: false, mensaje: 'Ya existe un sorteo para esa fecha y tipo.' }
  }
  const evaluadas = await evaluarPendientes(tipo)
  const entren = await entrenar(tipo)
  const pred = await predecir(tipo)
  return { ok: true, evaluadas, entrenamiento: entren, prediccion: pred }
}
