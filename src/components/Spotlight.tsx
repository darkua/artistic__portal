import { useEffect, useState, useRef } from 'react'

interface SpotlightProps {
  isActive: boolean
  onClose: () => void
}

export default function Spotlight({ isActive, onClose }: SpotlightProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isVisible, setIsVisible] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const spotlightSize = 400 // Size of the spotlight circle in pixels

  // Initialize mouse position to center of screen when activated
  useEffect(() => {
    if (isActive) {
      setMousePos({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
      // Small delay for fade-in animation
      setTimeout(() => setIsVisible(true), 10)
    } else {
      setIsVisible(false)
    }
  }, [isActive])

  // Track mouse movement
  useEffect(() => {
    if (!isActive) return

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [isActive])

  // Close on click anywhere
  useEffect(() => {
    if (!isActive) return

    const handleClick = () => {
      onClose()
    }

    // Use a small delay to prevent immediate closing when activating
    const timeout = setTimeout(() => {
      window.addEventListener('click', handleClick, true)
    }, 100)

    return () => {
      clearTimeout(timeout)
      window.removeEventListener('click', handleClick, true)
    }
  }, [isActive, onClose])

  if (!isActive) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] pointer-events-auto"
      style={{
        background: `radial-gradient(circle ${spotlightSize}px at ${mousePos.x}px ${mousePos.y}px, transparent 0%, transparent 35%, rgba(0, 0, 0, 0.85) 60%, rgba(0, 0, 0, 0.95) 80%, rgba(0, 0, 0, 1) 100%)`,
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.3s ease-in, background 0.15s ease-out',
      }}
    />
  )
}

