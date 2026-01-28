import { useTranslation } from '../hooks/useTranslation'
import portfolioData from '../data/portfolioData.json'
import { format } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { es } from 'date-fns/locale/es'

interface NewsItem {
  id: number
  date: string
  title: {
    en: string
    es: string
  }
  description: {
    en: string
    es: string
  }
}

export default function News() {
  const { t, language } = useTranslation()
  const newsItems = portfolioData.news as NewsItem[]

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-12 sm:mb-16">
          {t('news.title')}
        </h1>
        
        <div className="space-y-12 sm:space-y-16 max-w-3xl">
          {newsItems.map((item) => (
            <article key={item.id} className="border-b border-border pb-8 last:border-b-0">
              <time className="text-sm opacity-60 mb-4 block">
                {format(new Date(item.date), 'MMMM d, yyyy', {
                  locale: language === 'es' ? es : enUS
                })}
              </time>
              <h2 className="text-2xl sm:text-3xl font-light mb-4">
                {item.title[language as 'en' | 'es']}
              </h2>
              <p className="text-base opacity-80 leading-relaxed">
                {item.description[language as 'en' | 'es']}
              </p>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}

