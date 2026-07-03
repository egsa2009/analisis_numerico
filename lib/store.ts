'use client'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Tipo = 'Principal' | 'Secundario'

interface EstadoApp {
  tipo: Tipo
  setTipo: (t: Tipo) => void
}

export const useAppStore = create<EstadoApp>()(
  persist(
    (set) => ({
      tipo: 'Principal',
      setTipo: (t) => set({ tipo: t }),
    }),
    { name: 'oraculo-tipo' }
  )
)
