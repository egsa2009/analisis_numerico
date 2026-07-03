export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { predecir } from '@/lib/ml/servicio'
import { serializar } from '@/lib/serial'
import { TipoSorteo } from '@/lib/ml/tipos'

function tipoValido(t: string | null): TipoSorteo {
  return t === 'Secundario' ? 'Secundario' : 'Principal'
}

// Devuelve la última predicción guardada (o genera una nueva si no hay).
export async function GET(req: NextRequest) {
  try {
    const tipo = tipoValido(req.nextUrl.searchParams.get('tipo'))
    const ultima = await prisma.prediccion.findFirst({
      where: { tipo },
      orderBy: { generadaEn: 'desc' },
    })
    if (ultima) {
      const s: any = serializar(ultima)
      // El modelo Prisma guarda el número diferente como `diffNum`,
      // pero el resto de la UI (recién generada) lo espera como `diff`.
      return NextResponse.json({ ok: true, prediccion: { ...s, diff: s.diffNum } })
    }
    const gen = await predecir(tipo)
    return NextResponse.json(serializar(gen))
  } catch (e: any) {
    return NextResponse.json({ ok: false, mensaje: e?.message ?? 'Error' }, { status: 500 })
  }
}

// Fuerza la generación de una nueva predicción.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const tipo = tipoValido(body?.tipo ?? null)
    const gen = await predecir(tipo)
    return NextResponse.json(serializar(gen))
  } catch (e: any) {
    return NextResponse.json({ ok: false, mensaje: e?.message ?? 'Error' }, { status: 500 })
  }
}
