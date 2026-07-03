// Seed: parsea data/seed.sql (720 sorteos) e inserta vía Prisma upsert.
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

interface Fila {
  fecha: string
  tipo: string
  n1: number
  n2: number
  n3: number
  n4: number
  n5: number
  diff: number
}

function parseSeed(sql: string): Fila[] {
  const filas: Fila[] = []
  // captura: ('2023-04-19', 'Principal', 15, 18, 19, 32, 36, 8)
  const regex =
    /\(\s*'(\d{4}-\d{2}-\d{2})'\s*,\s*'(Principal|Secundario)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(sql)) !== null) {
    filas.push({
      fecha: m[1],
      tipo: m[2],
      n1: Number(m[3]),
      n2: Number(m[4]),
      n3: Number(m[5]),
      n4: Number(m[6]),
      n5: Number(m[7]),
      diff: Number(m[8]),
    })
  }
  return filas
}

async function main() {
  const ruta = path.join(process.cwd(), 'data', 'seed.sql')
  const sql = fs.readFileSync(ruta, 'utf-8')
  const filas = parseSeed(sql)
  console.log(`Parseadas ${filas.length} filas del seed.sql`)

  let insertadas = 0
  for (const f of filas) {
    await prisma.sorteo.upsert({
      where: { uq_fecha_tipo: { fecha: new Date(f.fecha), tipo: f.tipo } },
      create: {
        fecha: new Date(f.fecha),
        tipo: f.tipo,
        n1: f.n1,
        n2: f.n2,
        n3: f.n3,
        n4: f.n4,
        n5: f.n5,
        diff: f.diff,
      },
      update: {},
    })
    insertadas++
    if (insertadas % 100 === 0) console.log(`  ${insertadas}/${filas.length}`)
  }

  const principal = await prisma.sorteo.count({ where: { tipo: 'Principal' } })
  const secundario = await prisma.sorteo.count({ where: { tipo: 'Secundario' } })
  console.log(`Listo. Principal=${principal}, Secundario=${secundario}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
