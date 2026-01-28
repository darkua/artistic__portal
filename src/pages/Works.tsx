import { Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import portfolioData from '../data/portfolioData.json'

interface WorkImage {
  url: string
}

interface Work {
  id: number
  title: {
    en: string
    es: string
  }
  shortDescription?: {
    en: string
    es: string
  }
  description: {
    en: string
    es: string
  }
  // Thumbnail used for list/grid views
  thumbnail?: string
  // Optional gallery of images for the detail page
  images?: WorkImage[]
  year: number
}

interface WorksData {
  theaterDirector: Work[]
  actress: Work[]
  movieDirector: Work[]
}

function WorkGrid({ works, language }: { works: Work[]; language: 'en' | 'es' }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
      {works.map((work) => {
        // Thumbnail for the list; if missing, fall back to first gallery image
        let thumbnailUrl = work.thumbnail
        if (!thumbnailUrl && work.images && work.images.length > 0) {
          thumbnailUrl = work.images[0].url
        }

        return (
          <Link
            key={work.id}
            to={`/works/${work.id}`}
            className="group block overflow-hidden bg-gray-100 aspect-[4/3]"
          >
            <div className="relative w-full h-full">
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt={work.title[language]}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.display = 'none'
                    const parent = target.parentElement
                    if (parent) {
                      parent.innerHTML = `
                        <div class="w-full h-full flex items-center justify-center bg-gray-200">
                          <span class="text-gray-400 text-sm">${work.title[language]}</span>
                        </div>
                      `
                    }
                  }}
                />
              )}
              {!thumbnailUrl && (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <span className="text-gray-400 text-sm">{work.title[language]}</span>
                </div>
              )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-center px-4">
                <h3 className="text-lg font-light mb-2">
                  {work.title[language]}
                </h3>
                <p className="text-sm opacity-90">{work.year}</p>
              </div>
            </div>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-light mb-1">
                {work.title[language]}
              </h3>
              <p className="text-xs opacity-60">{work.year}</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export default function Works() {
  const { t, language } = useTranslation()
  const worksData = portfolioData.works as WorksData
  const lang = language as 'en' | 'es'

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-12 sm:mb-16">
          {t('works.title')}
        </h1>
        
        {/* Theater Director Section */}
        <section className="mb-16 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl font-light mb-8 sm:mb-12">
            {t('works.theaterDirector')}
          </h2>
          {worksData.theaterDirector && worksData.theaterDirector.length > 0 ? (
            <WorkGrid works={worksData.theaterDirector} language={lang} />
          ) : (
            <p className="text-sm opacity-60">{t('works.noWorks')}</p>
          )}
        </section>

        {/* Actress Section */}
        <section className="mb-16 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl font-light mb-8 sm:mb-12">
            {t('works.actress')}
          </h2>
          {worksData.actress && worksData.actress.length > 0 ? (
            <WorkGrid works={worksData.actress} language={lang} />
          ) : (
            <p className="text-sm opacity-60">{t('works.noWorks')}</p>
          )}
        </section>

        {/* Movie Director Section */}
        <section>
          <h2 className="text-2xl sm:text-3xl font-light mb-8 sm:mb-12">
            {t('works.movieDirector')}
          </h2>
          {worksData.movieDirector && worksData.movieDirector.length > 0 ? (
            <WorkGrid works={worksData.movieDirector} language={lang} />
          ) : (
            <p className="text-sm opacity-60">{t('works.noWorks')}</p>
          )}
        </section>
      </div>
    </div>
  )
}

