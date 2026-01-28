import { useTranslation } from '../hooks/useTranslation'
import portfolioData from '../data/portfolioData.json'

export default function CV() {
  const { t, language } = useTranslation()
  const cv = portfolioData.cv

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <div className="max-w-4xl">
          {/* Profile Image */}
          <div className="mb-12 sm:mb-16">
            <div className="w-48 h-64 sm:w-56 sm:h-80 bg-gray-200 flex items-center justify-center">
              <span className="text-gray-400 text-sm">{t('common.photo')}</span>
            </div>
          </div>

          {/* Bio */}
          <section className="mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-light mb-6">
              {t('cv.bio.title')}
            </h2>
            <div className="prose prose-sm max-w-none">
              <p className="text-base leading-relaxed opacity-90 whitespace-pre-line">
                {cv.bio[language as 'en' | 'es']}
              </p>
            </div>
          </section>

          {/* Education */}
          {cv.education && cv.education.length > 0 && (
            <section className="mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl font-light mb-6">
                {t('cv.education.title')}
              </h2>
              <div className="space-y-4">
                {cv.education.map((edu, index) => (
                  <div key={index}>
                    <p className="text-base font-light">
                      {edu.year} {edu.degree[language as 'en' | 'es']}
                    </p>
                    <p className="text-sm opacity-70">
                      {edu.institution[language as 'en' | 'es']}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}


          {/* Awards */}
          {cv.awards && cv.awards.length > 0 && (
            <section className="mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl font-light mb-6">
                {t('cv.awards.title')}
              </h2>
              <div className="space-y-4">
                {cv.awards.map((award, index) => (
                  <div key={index}>
                    <p className="text-base font-light">
                      {award.year} {award.title[language as 'en' | 'es']}
                    </p>
                    <p className="text-sm opacity-70">
                      {award.organization[language as 'en' | 'es']}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Collection */}
          {cv.collection && cv.collection.length > 0 && (
            <section>
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

