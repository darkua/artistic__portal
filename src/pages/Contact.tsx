import { useEffect, useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import portfolioData from '../data/portfolioData.json'
import { Instagram } from 'lucide-react'

export default function Contact() {
  const { t, language } = useTranslation()
  const [portfolioDataState, setPortfolioDataState] = useState<any>(portfolioData)

  // In development, watch for JSON file changes via HMR
  useEffect(() => {
    if ((import.meta as any).hot) {
      (import.meta as any).hot.accept('/src/data/portfolioData.json', (newModule: any) => {
        if (newModule) {
          setPortfolioDataState(newModule.default)
        }
      })
    }
  }, [])

  const contact = portfolioDataState.contact

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-12 sm:mb-16">
            {t('contact.title')}
          </h1>
          
          <div className="space-y-8">
            <div>
              <a
                href={`mailto:${contact.email}`}
                className="text-xl sm:text-2xl font-light hover:opacity-70 transition-opacity"
              >
                {contact.email}
              </a>
            </div>

            <div className="flex items-center space-x-6 pt-8">
              {contact.social.instagram && (
                <a
                  href={contact.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:opacity-70 transition-opacity"
                  aria-label="Instagram"
                >
                  <Instagram className="h-6 w-6" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

