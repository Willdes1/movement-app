'use client'
import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface ModalState {
  key: string | null
  fromGroup: string | null
}

interface ModalContextType {
  modal: ModalState
  openExercise: (key: string, fromGroup?: string) => void
  closeModal: () => void
}

const ModalContext = createContext<ModalContextType>({
  modal: { key: null, fromGroup: null },
  openExercise: () => {},
  closeModal: () => {},
})

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({ key: null, fromGroup: null })

  const openExercise = useCallback((key: string, fromGroup?: string) => {
    setModal({ key, fromGroup: fromGroup ?? null })
    document.body.style.overflow = 'hidden'
  }, [])

  const closeModal = useCallback(() => {
    setModal({ key: null, fromGroup: null })
    document.body.style.overflow = ''
  }, [])

  return (
    <ModalContext.Provider value={{ modal, openExercise, closeModal }}>
      {children}
    </ModalContext.Provider>
  )
}

export function useModal() {
  return useContext(ModalContext)
}
