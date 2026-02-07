import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { ChevronDown } from 'lucide-react'

const languageLabels: Record<string, string> = {
  es: 'ES',
  en: 'EN',
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const otherLanguage = language === 'es' ? 'en' : 'es'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-sm uppercase tracking-wide hover:opacity-70 transition-opacity"
        aria-label="Switch Language"
      >
        {languageLabels[language]}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 bg-background border border-border shadow-lg rounded z-50 min-w-[3rem]">
          <button
            onClick={() => {
              setLanguage(otherLanguage)
              setIsOpen(false)
            }}
            className="block w-full px-3 py-2 text-sm uppercase tracking-wide hover:opacity-70 transition-opacity text-center"
          >
            {languageLabels[otherLanguage]}
          </button>
        </div>
      )}
    </div>
  )
}
