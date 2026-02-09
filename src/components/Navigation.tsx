import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { LanguageSwitcher } from './LanguageSwitcher'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useSpotlight } from '../contexts/SpotlightContext'

export default function Navigation() {
  const { t } = useTranslation()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { activate } = useSpotlight()

  const navItems = [
    { path: '/', key: 'nav.home' },
    { path: '/works', key: 'nav.works' },
    { path: '/assistant-direction', key: 'nav.assistantDirection' },
    { path: '/news', key: 'nav.news' },
    { path: '/gallery', key: 'nav.gallery' },
    { path: '/contact', key: 'nav.contact' },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <nav className="w-full border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Home Link */}
          <Link
            to="/"
            className="hover:opacity-70 transition-opacity"
            onClick={(e) => {
              e.preventDefault() // Prevent navigation, only activate spotlight
              activate({ x: e.clientX, y: e.clientY })
            }}
          >
            <img
              src="/logo.png"
              alt={t('home.title')}
              className="h-10 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm uppercase tracking-wide transition-opacity hover:opacity-70 ${
                  isActive(item.path) ? 'opacity-100' : 'opacity-60'
                }`}
              >
                {t(item.key)}
              </Link>
            ))}
            <LanguageSwitcher />
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 space-y-4 border-t border-border">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block text-sm uppercase tracking-wide transition-opacity hover:opacity-70 ${
                  isActive(item.path) ? 'opacity-100' : 'opacity-60'
                }`}
              >
                {t(item.key)}
              </Link>
            ))}
            <div className="pt-4 border-t border-border">
              <LanguageSwitcher />
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

