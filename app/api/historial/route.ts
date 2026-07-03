export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fechaISO } from '@/lib/serial'

function tipoValido(t: string | null) {
  return t === 'Secundario' ? 'Secundario' : 'Principal'
}

export async function GET(req: NextRequest) {
  try {
    const tipo = tipoValido(req.nextUrl.searchParams.get('tipo'))
    const filas = await prisma.prediccion.findMany({
      where: { tipo },
      orderBy: { generadaEn: 'desc' },
      take: 200,
    })
    const preds = (filas ?? []).map((p) => ({
      id: Number(p.id),
      tipo: p.tipo,
      generadaEn: fechaISO(p.generadaEn),
      ultimoSorteo: fechaISO(p.ultimoSorteo),
      numeros: p.numeros,
      diff: p.diffNum,
      modeloLider: p.modeloLider,
      confianza: p.confianza,
      explicacion: p.explicacion,
      evaluada: p.evaluada,
      resultadoFecha: fechaISO(p.resultadoFecha),
      reales: p.reales,
      rDiff: p.rDiff,
      aciertos: p.aciertos,
      diffAcertado: p.diffAcertado,
    }))
    const evaluadas = preds.filter((p) => p.evaluada)
    const totalAciertos = evaluadas.reduce((a, p) => a + (p.aciertos ?? 0), 0)
    const promedio = evaluadas.length > 0 ? totalAciertos / evaluadas.length : 0
    const diffAciertos = evaluadas.filter((p) => p.diffAcertado).length
    return NextResponse.json({
      ok: true,
      predicciones: preds,
      resumen: {
        totalPredicciones: preds.length,
        evaluadas: evaluadas.length,
        promedioAciertos: promedio,
        hitRate: evaluadas.length > 0 ? promedio / 5 : 0,
        diffHitRate: evaluadas.length > 0 ? diffAciertos / evaluadas.length : 0,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, mensaje: e?.message ?? 'Error' }, { status: 500 })
  }
}
