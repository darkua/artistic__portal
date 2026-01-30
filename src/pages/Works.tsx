import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
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

// Component for a single work item with fixed thumbnail size for consistent rendering
function WorkItem({
  work,
  language,
  onThumbnailUpdate,
}: {
  work: Work
  language: 'en' | 'es'
  onThumbnailUpdate?: (workId: number, newThumbnail: string) => void
}) {
  const [showThumbnailModal, setShowThumbnailModal] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const isAdminMode = (import.meta as any).env.VITE_ADMIN_MODE === 'true'
  // Thumbnail for the list; if missing, fall back to first gallery image
  let thumbnailUrl = work.thumbnail
  if (!thumbnailUrl && work.images && work.images.length > 0) {
    thumbnailUrl = work.images[0].url
  }

  // Fixed width for all thumbnails (vertical posters)
  // On mobile, use full width with max constraint; on larger screens, use fixed width
  // "El último paquete" (id: 4) needs larger width to match INFIEL's vertical size
  const fixedWidth = work.id === 4 ? 640 : 480 // Fixed width in pixels for consistent sizing

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('thumbnail', file)

      const response = await fetch(`/api/works/${work.id}/thumbnail`, {
        method: 'PUT',
        body: formData,
      })

      if (!response.ok) {
        let message = 'Error uploading thumbnail'
        try {
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const data = await response.json()
            if (data && data.error) message = data.error
          } else {
            message = `Server error: ${response.status} ${response.statusText}`
          }
        } catch {
          message = `Server error: ${response.status} ${response.statusText}`
        }
        throw new Error(message)
      }

      const data = await response.json()
      if (data.thumbnail && onThumbnailUpdate) {
        onThumbnailUpdate(work.id, data.thumbnail)
      }
      setShowThumbnailModal(false)
    } catch (error: any) {
      console.error('Thumbnail upload error:', error)
      setUploadError(error.message || 'Error uploading thumbnail')
    } finally {
      setIsUploading(false)
      // Reset file input
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  return (
    <>
      <div className="flex flex-col work-item-vertical" style={{ width: `${fixedWidth}px`, maxWidth: '100%', flexShrink: 0 }}>
        <div className="relative">
          <Link
            to={`/works/${work.id}`}
            className="group block overflow-hidden"
            style={{ width: '100%' }}
          >
            <div className="relative w-full" style={{ aspectRatio: 'auto' }}>
              {thumbnailUrl && (
                <img
                  src={thumbnailUrl}
                  alt={work.title[language]}
                  className="w-full h-auto object-contain transition-transform duration-300 group-hover:scale-105"
                  style={{ maxHeight: 'none' }}
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
                <div className="w-full h-64 flex items-center justify-center bg-gray-200">
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
          {isAdminMode && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowThumbnailModal(true)
              }}
              className="absolute top-2 right-2 bg-black/70 hover:bg-black/90 text-white p-1.5 rounded text-xs transition-colors"
              title="Edit thumbnail"
            >
              ✏️
            </button>
          )}
        </div>
        <div className="mt-4">
          <h3 className="text-sm font-light mb-1">
            {work.title[language]}
          </h3>
          <p className="text-xs opacity-60">{work.year}</p>
        </div>
      </div>

      {/* Thumbnail Upload Modal */}
      {showThumbnailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowThumbnailModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-light mb-4">Update Thumbnail</h2>
            <p className="text-sm text-gray-600 mb-4">Upload a new thumbnail image for "{work.title[language]}"</p>
            
            <input
              type="file"
              accept="image/*"
              onChange={handleThumbnailUpload}
              disabled={isUploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 disabled:opacity-50"
            />

            {uploadError && (
              <p className="mt-4 text-sm text-red-600">{uploadError}</p>
            )}

            {isUploading && (
              <p className="mt-4 text-sm text-gray-600">Uploading and processing...</p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowThumbnailModal(false)
                  setUploadError(null)
                }}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                disabled={isUploading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function WorkGrid({
  works,
  language,
  onThumbnailUpdate,
}: {
  works: Work[]
  language: 'en' | 'es'
  onThumbnailUpdate?: (workId: number, newThumbnail: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-6 sm:gap-8">
      {works.map((work) => (
        <WorkItem key={work.id} work={work} language={language} onThumbnailUpdate={onThumbnailUpdate} />
      ))}
    </div>
  )
}

export default function Works() {
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

  const worksData = portfolioDataState.works as WorksData
  const lang = language as 'en' | 'es'
  const worksPage: any = portfolioDataState.worksPage

  // Handle thumbnail updates
  const handleThumbnailUpdate = (workId: number, newThumbnail: string) => {
    setPortfolioDataState((prev: any) => {
      const updated = { ...prev }
      const sections = ['theaterDirector', 'actress', 'movieDirector', 'assistantDirection'] as const
      for (const section of sections) {
        if (Array.isArray(updated.works[section])) {
          const index = updated.works[section].findIndex((w: Work) => w.id === workId)
          if (index !== -1) {
            updated.works[section][index] = { ...updated.works[section][index], thumbnail: newThumbnail }
            break
          }
        }
      }
      return updated
    })
  }

  // Sort theater works by year so PERSONA (2024) appears last
  const sortedTheaterDirector = [...(worksData?.theaterDirector || [])].sort(
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
                 <WorkGrid works={sortedTheaterDirector} language={lang} onThumbnailUpdate={handleThumbnailUpdate} />
               ) : (
                 <p className="text-sm opacity-60">{t('works.noWorks')}</p>
               )}
             </section>

             {/* Movie Director Section */}
             <section>
               <h2 className="text-2xl sm:text-3xl font-light mb-8 sm:mb-12">
                 {t('works.movieDirector')}
               </h2>
               {worksData?.movieDirector && worksData.movieDirector.length > 0 ? (
                 <WorkGrid works={worksData.movieDirector} language={lang} onThumbnailUpdate={handleThumbnailUpdate} />
               ) : (
                 <p className="text-sm opacity-60">{t('works.noWorks')}</p>
               )}
             </section>
      </div>
    </div>
  )
}

