export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { MODELOS, ModeloId, NOMBRES_MODELOS } from '@/lib/ml/tipos'

function tipoValido(t: string | null) {
  return t === 'Secundario' ? 'Secundario' : 'Principal'
}

export async function GET(req: NextRequest) {
  try {
    const tipo = tipoValido(req.nextUrl.searchParams.get('tipo'))

    // performance actual (último registro por modelo)
    const actual: any[] = []
    for (const m of MODELOS) {
      const p = await prisma.modeloPerformance.findFirst({
        where: { tipo, modelo: m },
        orderBy: { evaluadoEn: 'desc' },
      })
      if (p) {
        actual.push({
          modelo: m,
          nombre: NOMBRES_MODELOS[m as ModeloId],
          mae: p.mae,
          rmse: p.rmse,
          precisionMedia: p.precisionMedia,
          hitRate: p.hitRate,
          muestras: p.muestras,
          peso: p.peso,
          params: p.params,
        })
      }
    }

    // evolución histórica de pesos/precisión (últimos 40 registros)
    const historico = await prisma.modeloPerformance.findMany({
      where: { tipo },
      orderBy: { evaluadoEn: 'asc' },
      take: 240,
    })

    // agrupar por timestamp de evaluación
    const evolucion: Record<string, any> = {}
    for (const h of historico ?? []) {
      const key = h.evaluadoEn.toISOString()
      if (!evolucion[key]) evolucion[key] = { fecha: key }
      evolucion[key][h.modelo] = Number((h.precisionMedia ?? 0).toFixed(3))
    }

    return NextResponse.json({
      ok: true,
      actual: actual.sort((a, b) => b.peso - a.peso),
      evolucion: Object.values(evolucion),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, mensaje: e?.message ?? 'Error' }, { status: 500 })
  }
}
