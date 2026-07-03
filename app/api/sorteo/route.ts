export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { agregarSorteo } from '@/lib/ml/servicio'
import { serializar, fechaISO } from '@/lib/serial'
import { TipoSorteo } from '@/lib/ml/tipos'

function tipoValido(t: string | null): TipoSorteo {
  return t === 'Secundario' ? 'Secundario' : 'Principal'
}

// Lista sorteos (paginado ligero)
export async function GET(req: NextRequest) {
  try {
    const tipo = tipoValido(req.nextUrl.searchParams.get('tipo'))
    const limite = Math.min(500, Number(req.nextUrl.searchParams.get('limite') ?? 100))
    const filas = await prisma.sorteo.findMany({
      where: { tipo },
      orderBy: { fecha: 'desc' },
      take: limite,
    })
    const total = await prisma.sorteo.count({ where: { tipo } })
    return NextResponse.json({
      ok: true,
      total,
      sorteos: (filas ?? []).map((s) => ({
        id: Number(s.id),
        fecha: fechaISO(s.fecha),
        tipo: s.tipo,
        numeros: [s.n1, s.n2, s.n3, s.n4, s.n5],
        diff: s.diff,
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, mensaje: e?.message ?? 'Error' }, { status: 500 })
  }
}

// Ingresa un sorteo real y dispara el ciclo de aprendizaje completo.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const tipo = tipoValido(body?.tipo ?? null)
    const res = await agregarSorteo({
      fecha: body?.fecha,
      tipo,
      n: body?.numeros ?? body?.n ?? [],
      diff: Number(body?.diff),
    })
    return NextResponse.json(serializar(res))
  } catch (e: any) {
    return NextResponse.json({ ok: false, mensaje: e?.message ?? 'Error' }, { status: 500 })
  }
}
