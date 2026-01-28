import { useLanguage } from '../contexts/LanguageContext'
import enTranslations from '../translations/en.json'
import esTranslations from '../translations/es.json'

const translations = {
  en: enTranslations,
  es: esTranslations,
}

export function useTranslation() {
  const { language } = useLanguage()

  const t = (key: string): string => {
    const keys = key.split('.')
    let value: any = translations[language]

    for (const k of keys) {
      value = value?.[k]
    }

    // Fallback to English if translation is missing
    if (value === undefined) {
      value = translations.en
      for (const k of keys) {
        value = value?.[k]
      }
    }

    return value ?? key
  }

  return { t, language }
}

