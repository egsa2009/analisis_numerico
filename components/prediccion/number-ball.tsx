'use client'
import { cn } from '@/lib/utils'

export function NumberBall({
  n,
  variant = 'default',
  size = 'md',
  className,
}: {
  n: number | null | undefined
  variant?: 'default' | 'diff' | 'hit' | 'miss' | 'muted'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizes = {
    sm: 'h-8 w-8 text-sm',
    md: 'h-11 w-11 text-base',
    lg: 'h-14 w-14 text-xl',
  }
  const variants = {
    default:
      'bg-gradient-to-br from-primary to-violet-600 text-primary-foreground shadow-md',
    diff: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md',
    hit: 'bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-md ring-2 ring-emerald-300',
    miss: 'bg-muted text-muted-foreground',
    muted: 'bg-secondary text-secondary-foreground',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-mono font-bold tabular-nums transition-transform hover:scale-110',
        sizes[size],
        variants[variant],
        className
      )}
    >
      {n ?? '-'}
    </span>
  )
}
