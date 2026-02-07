import { createContext, useContext, useState, useRef, ReactNode } from 'react'

interface SpotlightContextType {
  isActive: boolean
  initialPos: { x: number; y: number } | null
  activate: (pos?: { x: number; y: number }) => void
  deactivate: () => void
  toggle: (pos?: { x: number; y: number }) => void
}

const SpotlightContext = createContext<SpotlightContextType | undefined>(undefined)

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false)
  const initialPosRef = useRef<{ x: number; y: number } | null>(null)

  const activate = (pos?: { x: number; y: number }) => {
    initialPosRef.current = pos || null
    setIsActive(true)
  }
  const deactivate = () => {
    setIsActive(false)
    initialPosRef.current = null
  }
  const toggle = (pos?: { x: number; y: number }) => {
    setIsActive((prev) => {
      if (!prev) {
        initialPosRef.current = pos || null
      } else {
        initialPosRef.current = null
      }
      return !prev
    })
  }

  return (
    <SpotlightContext.Provider value={{ isActive, initialPos: initialPosRef.current, activate, deactivate, toggle }}>
      {children}
    </SpotlightContext.Provider>
  )
}

export function useSpotlight() {
  const context = useContext(SpotlightContext)
  if (context === undefined) {
    throw new Error('useSpotlight must be used within a SpotlightProvider')
  }
  return context
}

