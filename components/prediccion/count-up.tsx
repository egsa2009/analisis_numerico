'use client'
import { useEffect, useRef, useState } from 'react'
import { useInView } from 'framer-motion'

export function CountUp({
  value,
  decimals = 0,
  suffix = '',
  duration = 1200,
}: {
  value: number
  decimals?: number
  suffix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const enVista = useInView(ref, { once: true, margin: '-40px' })
  const [val, setVal] = useState(0)

  useEffect(() => {
    if (!enVista) return
    let raf = 0
    const inicio = performance.now()
    const objetivo = Number.isFinite(value) ? value : 0
    const animar = (t: number) => {
      const p = Math.min(1, (t - inicio) / duration)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(objetivo * ease)
      if (p < 1) raf = requestAnimationFrame(animar)
    }
    raf = requestAnimationFrame(animar)
    return () => cancelAnimationFrame(raf)
  }, [enVista, value, duration])

  return (
    <span ref={ref} className="tabular-nums">
      {val.toFixed(decimals)}
      {suffix}
    </span>
  )
}
