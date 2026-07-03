export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { entrenar } from '@/lib/ml/servicio'
import { serializar } from '@/lib/serial'
import { TipoSorteo } from '@/lib/ml/tipos'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const tipo: TipoSorteo = body?.tipo === 'Secundario' ? 'Secundario' : 'Principal'
    const res = await entrenar(tipo)
    return NextResponse.json(serializar(res))
  } catch (e: any) {
    return NextResponse.json({ ok: false, mensaje: e?.message ?? 'Error' }, { status: 500 })
  }
}
