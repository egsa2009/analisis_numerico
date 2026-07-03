// Tipos compartidos del motor de predicción con auto-aprendizaje

export type TipoSorteo = 'Principal' | 'Secundario'

export interface SorteoLite {
  fecha: string // ISO date
  n: number[] // 5 números principales
  diff: number
}

// Rangos del dominio
export const MAX_PRINCIPAL = 43
export const MAX_DIFF = 16
export const K_PRINCIPALES = 5

// Identificadores de modelos
export const MODELOS = [
  'frecuencia_adaptativa',
  'promedio_movil',
  'regresion_lineal',
  'patrones_temporales',
  'coocurrencia',
  'red_neuronal',
] as const

export type ModeloId = (typeof MODELOS)[number]

export const NOMBRES_MODELOS: Record<ModeloId, string> = {
  frecuencia_adaptativa: 'Frecuencia Adaptativa',
  promedio_movil: 'Promedio Móvil Ponderado',
  regresion_lineal: 'Regresión Lineal',
  patrones_temporales: 'Patrones Temporales Dinámicos',
  coocurrencia: 'Análisis de Coocurrencia',
  red_neuronal: 'Red Neuronal Simple',
}

export const DESCRIPCIONES_MODELOS: Record<ModeloId, string> = {
  frecuencia_adaptativa:
    'Cuenta apariciones con decaimiento exponencial: los sorteos recientes pesan más que los antiguos.',
  promedio_movil:
    'Promedio móvil ponderado de la señal de aparición de cada número en una ventana reciente.',
  regresion_lineal:
    'Ajusta una recta a la frecuencia por bloques y proyecta la tendencia hacia el próximo sorteo.',
  patrones_temporales:
    'Modela la “sequía” (sorteos sin aparecer) y el intervalo medio esperado de cada número.',
  coocurrencia:
    'Puntúa números por su afinidad de aparición conjunta con los del último sorteo.',
  red_neuronal:
    'Perceptrón multicapa ligero (entrenado en el navegador/servidor) sobre rasgos de frecuencia, sequía y tendencia.',
}

// Hiperparámetros por modelo (ajustables por el auto-aprendizaje)
export interface Hiperparams {
  [k: string]: number
}

export const PARAMS_DEFAULT: Record<ModeloId, Hiperparams> = {
  frecuencia_adaptativa: { decaimiento: 0.97 },
  promedio_movil: { ventana: 30, sesgo: 1.5 },
  regresion_lineal: { bloques: 6 },
  patrones_temporales: { sensibilidad: 1.0 },
  coocurrencia: { profundidad: 40 },
  red_neuronal: { epochs: 120, lr: 0.05, oculta: 8 },
}

// Espacio de búsqueda para el ajuste automático de hiperparámetros
export const ESPACIO_PARAMS: Record<ModeloId, Record<string, number[]>> = {
  frecuencia_adaptativa: { decaimiento: [0.9, 0.95, 0.97, 0.99] },
  promedio_movil: { ventana: [15, 25, 40], sesgo: [1.0, 1.5, 2.5] },
  regresion_lineal: { bloques: [4, 6, 10] },
  patrones_temporales: { sensibilidad: [0.6, 1.0, 1.5] },
  coocurrencia: { profundidad: [20, 40, 80] },
  red_neuronal: { epochs: [80, 120], lr: [0.03, 0.05, 0.1], oculta: [6, 8] },
}

export interface ScoreModelo {
  modelo: ModeloId
  // score por número principal (índice 0 => número 1)
  scoresPrincipal: number[]
  // score por número diferente
  scoresDiff: number[]
  topPrincipal: number[] // top-5 sugeridos
  topDiff: number // top-1 sugerido
}

export interface PerfModelo {
  modelo: ModeloId
  mae: number
  rmse: number
  precisionMedia: number // aciertos promedio 0-5
  hitRate: number // 0-1
  muestras: number
  peso: number
  params: Hiperparams
}
