// Serializa objetos con BigInt/Date para respuestas JSON seguras.
export function serializar<T>(data: T): T {
  return JSON.parse(
    JSON.stringify(data, (_k, v) => {
      if (typeof v === 'bigint') return Number(v)
      return v
    })
  )
}

export function fechaISO(d: Date | string | null | undefined): string {
  if (!d) return ''
  try {
    const dt = typeof d === 'string' ? new Date(d) : d
    return dt.toISOString().slice(0, 10)
  } catch {
    return ''
  }
}
