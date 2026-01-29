import { createContext, useContext, useState, ReactNode } from 'react'

interface SpotlightContextType {
  isActive: boolean
  activate: () => void
  deactivate: () => void
  toggle: () => void
}

const SpotlightContext = createContext<SpotlightContextType | undefined>(undefined)

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false)

  const activate = () => setIsActive(true)
  const deactivate = () => setIsActive(false)
  const toggle = () => setIsActive((prev) => !prev)

  return (
    <SpotlightContext.Provider value={{ isActive, activate, deactivate, toggle }}>
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

