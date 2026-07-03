export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const tipo = req.nextUrl.searchParams.get('tipo')
    const evento = req.nextUrl.searchParams.get('evento')
    const where: any = {}
    if (tipo === 'Principal' || tipo === 'Secundario') where.tipo = tipo
    if (evento) where.evento = evento
    const filas = await prisma.logAprendizaje.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 120,
    })
    return NextResponse.json({
      ok: true,
      logs: (filas ?? []).map((l) => ({
        id: Number(l.id),
        tipo: l.tipo,
        evento: l.evento,
        titulo: l.titulo,
        detalle: l.detalle,
        data: l.data,
        createdAt: l.createdAt.toISOString(),
      })),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, mensaje: e?.message ?? 'Error' }, { status: 500 })
  }
}
