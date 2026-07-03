export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fechaISO } from '@/lib/serial'

function tipoValido(t: string | null) {
  return t === 'Secundario' ? 'Secundario' : 'Principal'
}

// Exporta el reporte de predicciones vs realidad en CSV.
export async function GET(req: NextRequest) {
  try {
    const tipo = tipoValido(req.nextUrl.searchParams.get('tipo'))
    const filas = await prisma.prediccion.findMany({
      where: { tipo },
      orderBy: { generadaEn: 'desc' },
      take: 500,
    })
    const encabezado = [
      'id',
      'tipo',
      'generada_en',
      'ultimo_sorteo',
      'prediccion',
      'diff_pred',
      'modelo_lider',
      'confianza',
      'resultado_fecha',
      'reales',
      'diff_real',
      'aciertos',
      'diff_acertado',
    ]
    const lineas = (filas ?? []).map((p) =>
      [
        Number(p.id),
        p.tipo,
        fechaISO(p.generadaEn),
        fechaISO(p.ultimoSorteo),
        `"${(p.numeros ?? []).join(' ')}"`,
        p.diffNum,
        p.modeloLider,
        p.confianza,
        fechaISO(p.resultadoFecha),
        `"${(p.reales ?? []).join(' ')}"`,
        p.rDiff ?? '',
        p.aciertos ?? '',
        p.diffAcertado === null ? '' : p.diffAcertado ? 'si' : 'no',
      ].join(',')
    )
    const csv = [encabezado.join(','), ...lineas].join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename=reporte_${tipo}_${fechaISO(new Date())}.csv`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, mensaje: e?.message ?? 'Error' }, { status: 500 })
  }
}
