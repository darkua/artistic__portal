import { useTranslation } from '../hooks/useTranslation'
import portfolioData from '../data/portfolioData.json'
import EditableText from '../components/EditableText'

interface Work {
  id: number
  title: {
    en: string
    es: string
  }
  year: number
}

export default function CV() {
  const { t, language } = useTranslation()
  const lang = language as 'en' | 'es'
  const cv = portfolioData.cv
  const worksData = portfolioData.works as {
    theaterDirector: Work[]
  }

  // Get all theater director works for exhibitions
  const exhibitions = worksData.theaterDirector || []
  // Sort by year (oldest first)
  const sortedExhibitions = [...exhibitions].sort((a, b) => a.year - b.year)

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-4xl">
          {/* Profile Image */}
          <div className="mb-12 sm:mb-16">
            <img
              src="/works/persona/persona-4.jpg"
              alt="Elma Hache"
              className="w-48 h-64 sm:w-56 sm:h-80 object-cover"
            />
          </div>

          {/* Bio */}
          <section className="mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-light mb-6">
              {t('cv.bio.title')}
            </h2>
            <div className="prose prose-sm max-w-none">
              <EditableText
                dataPath="cv.bio"
                language={lang}
                className="text-base leading-relaxed opacity-90 whitespace-pre-line"
                as="p"
                multiline
              >
                {cv.bio[lang]}
              </EditableText>
            </div>
          </section>

          {/* Exhibitions */}
          {sortedExhibitions.length > 0 && (
            <section>
              <h2 className="text-2xl sm:text-3xl font-light mb-8 sm:mb-12">
                {t('cv.exhibitions.title')}
              </h2>
              <div className="space-y-6">
                {sortedExhibitions.map((work) => (
                  <div key={work.id} className="border-b border-border pb-6 last:border-b-0">
                    <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-4">
                      <p className="text-base font-light">
                        {work.year}
                      </p>
                      <p className="text-base font-light">
                        {work.title[lang]}
                      </p>
                      <p className="text-sm opacity-70">
                        Murcia
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Collection */}
          {cv.collection && cv.collection.length > 0 && (
            <section className="mt-12 sm:mt-16">
              <h2 className="text-2xl sm:text-3xl font-light mb-6">
                {t('cv.collection.title')}
              </h2>
              <div className="space-y-2">
                {cv.collection.map((item, index) => (
                  <p key={index} className="text-base opacity-90">
                    {item.name[language as 'en' | 'es']}
                  </p>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

