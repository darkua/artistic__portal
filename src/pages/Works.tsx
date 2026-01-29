import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import portfolioData from '../data/portfolioData.json'
import EditableText from '../components/EditableText'

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

// Component for a single work item that detects image orientation and sets size to 66% of original (100% for "El Engaño y Quiñones")
function WorkItem({
  work,
  language,
}: {
  work: Work
  language: 'en' | 'es'
}) {
  const [imageDimensions, setImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)

  // Thumbnail for the list; if missing, fall back to first gallery image
  let thumbnailUrl = work.thumbnail
  if (!thumbnailUrl && work.images && work.images.length > 0) {
    thumbnailUrl = work.images[0].url
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    // Use 100% for "El Engaño y Quiñones" (id: 7), 66% for others
    const scale = work.id === 7 ? 0.75 : 0.66
    const width = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)
    setImageDimensions({ width, height })
  }

  // Calculate container style based on image size (66% for most, 75% for "El Engaño y Quiñones")
  // Use a max pixel width so thumbnails have a fixed size on larger screens,
  // but allow them to shrink responsively on small screens (mobile).
  const containerStyle: React.CSSProperties = imageDimensions
    ? {
        width: `${imageDimensions.width}px`,
        maxWidth: '100%', // never exceed viewport on mobile
        flexShrink: 0,
      }
    : {
        // Default size before image loads
        width: '100%',
      }

  return (
    <div className="flex flex-col work-item-vertical" style={containerStyle}>
      <Link
        to={`/works/${work.id}`}
        className="group block overflow-hidden"
        // Let the image define the height so it scales down naturally on small screens
        style={imageDimensions ? { width: '100%' } : {}}
      >
        <div className="relative w-full h-full">
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={work.title[language]}
              className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
              onLoad={handleImageLoad}
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
      </Link>
      <div className="mt-4">
        <h3 className="text-sm font-light mb-1">
          {work.title[language]}
        </h3>
        <p className="text-xs opacity-60">{work.year}</p>
      </div>
    </div>
  )
}

function WorkGrid({
  works,
  language,
}: {
  works: Work[]
  language: 'en' | 'es'
}) {
  return (
    <div className="flex flex-wrap gap-6 sm:gap-8">
      {works.map((work) => (
        <WorkItem key={work.id} work={work} language={language} />
      ))}
    </div>
  )
}

export default function Works() {
  const { t, language } = useTranslation()
  const worksData = portfolioData.works as WorksData
  const lang = language as 'en' | 'es'
  const worksPage: any = (portfolioData as any).worksPage

  // Sort theater works by year so PERSONA (2024) appears last
  const sortedTheaterDirector = [...worksData.theaterDirector].sort(
    (a, b) => a.year - b.year
  )

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-4 sm:mb-6">
          {t('works.title')}
        </h1>

        {worksPage?.description && (
          <div className="max-w-4xl mb-10 sm:mb-12">
            <EditableText
              dataPath="worksPage.description"
              language={lang}
              className="text-base sm:text-lg leading-relaxed opacity-90 whitespace-pre-line"
              as="p"
              multiline
            >
              {worksPage.description[lang]}
            </EditableText>
          </div>
        )}
        
        {/* Theater Director Section */}
        <section className="mb-16 sm:mb-20">
          <h2 className="text-2xl sm:text-3xl font-light mb-8 sm:mb-12">
            {t('works.theaterDirector')}
          </h2>
          {sortedTheaterDirector && sortedTheaterDirector.length > 0 ? (
            <WorkGrid works={sortedTheaterDirector} language={lang} />
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
            <WorkGrid
              works={worksData.movieDirector}
              language={lang}
            />
          ) : (
            <p className="text-sm opacity-60">{t('works.noWorks')}</p>
          )}
        </section>
      </div>
    </div>
  )
}

