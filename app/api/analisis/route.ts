export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { getHistorial } from '@/lib/ml/servicio'
import { detectarCambioRegimen } from '@/lib/ml/motor'
import { MAX_DIFF, MAX_PRINCIPAL } from '@/lib/ml/tipos'

function tipoValido(t: string | null) {
  return t === 'Secundario' ? 'Secundario' : 'Principal'
}

// Series temporales y estadísticas para las visualizaciones.
export async function GET(req: NextRequest) {
  try {
    const tipo = tipoValido(req.nextUrl.searchParams.get('tipo'))
    const hist = await getHistorial(tipo)
    const n = hist?.length ?? 0

    // frecuencia global principal
    const frecP = new Array(MAX_PRINCIPAL).fill(0)
    const frecD = new Array(MAX_DIFF).fill(0)
    for (const s of hist) {
      ;(s?.n ?? []).forEach((num) => {
        if (num >= 1 && num <= MAX_PRINCIPAL) frecP[num - 1]++
      })
      if (s?.diff >= 1 && s?.diff <= MAX_DIFF) frecD[s.diff - 1]++
    }

    // sequía actual por número
    const sequia = new Array(MAX_PRINCIPAL).fill(0)
    for (let num = 1; num <= MAX_PRINCIPAL; num++) {
      let c = 0
      for (let i = n - 1; i >= 0; i--) {
        if ((hist[i]?.n ?? []).includes(num)) break
        c++
      }
      sequia[num - 1] = c
    }

    // serie temporal: suma de números por sorteo (últimos 60)
    const serie = hist.slice(-60).map((s) => ({
      fecha: s.fecha,
      suma: (s?.n ?? []).reduce((a, b) => a + b, 0),
      diff: s.diff,
      promedio: Number(((s?.n ?? []).reduce((a, b) => a + b, 0) / 5).toFixed(1)),
    }))

    const regimen = detectarCambioRegimen(hist)

    return NextResponse.json({
      ok: true,
      total: n,
      frecuenciaPrincipal: frecP.map((v, i) => ({ numero: i + 1, frecuencia: v })),
      frecuenciaDiff: frecD.map((v, i) => ({ numero: i + 1, frecuencia: v })),
      sequia: sequia.map((v, i) => ({ numero: i + 1, sequia: v })),
      serie,
      regimen,
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, mensaje: e?.message ?? 'Error' }, { status: 500 })
  }
}
