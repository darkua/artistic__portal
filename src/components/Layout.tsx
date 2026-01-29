import { ReactNode } from 'react'
import Navigation from './Navigation'
import Footer from './Footer'
import Spotlight from './Spotlight'
import { useSpotlight } from '../contexts/SpotlightContext'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { isActive, deactivate } = useSpotlight()

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      <main className="flex-1 w-full">{children}</main>
      <Footer />
      <Spotlight isActive={isActive} onClose={deactivate} />
    </div>
  )
}

