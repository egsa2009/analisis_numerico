export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { fechaISO } from '@/lib/serial'

export async function GET(req: NextRequest) {
  try {
    const limite = Math.min(100, Number(req.nextUrl.searchParams.get('limite') ?? 30))
    const tipo = req.nextUrl.searchParams.get('tipo')
    const where = tipo && (tipo === 'Principal' || tipo === 'Secundario') ? { tipo } : {}

    const filas = await prisma.sorteo.findMany({
      where,
      orderBy: [{ fecha: 'desc' }, { tipo: 'asc' }],
      take: limite,
    })
    const totalP = await prisma.sorteo.count({ where: { tipo: 'Principal' } })
    const totalS = await prisma.sorteo.count({ where: { tipo: 'Secundario' } })

    return NextResponse.json({
      ok: true,
      total: totalP + totalS,
      totalPrincipal: totalP,
      totalSecundario: totalS,
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
