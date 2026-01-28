import { useLanguage } from '../contexts/LanguageContext'

export function LanguageSwitcher() {
  const { language, toggleLanguage } = useLanguage()

  return (
    <button
      onClick={toggleLanguage}
      className="text-sm uppercase tracking-wide hover:opacity-70 transition-opacity"
      aria-label="Switch Language"
    >
      {language === 'en' ? 'ES' : 'EN'}
    </button>
  )
}

