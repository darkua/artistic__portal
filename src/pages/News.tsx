import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import EditableText from '../components/EditableText'
import CreateWorkForm from '../components/CreateWorkForm'
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
  thumbnail?: string
  images?: WorkImage[]
  year: number
}

// Component for a single work item (reused from Works.tsx)
function WorkItem({
  work,
  language,
  onDelete,
  isAdminMode,
}: {
  work: Work
  language: 'en' | 'es'
  onDelete?: (workId: number) => void
  isAdminMode?: boolean
}) {
  const [imageDimensions, setImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)

  let thumbnailUrl = work.thumbnail
  if (!thumbnailUrl && work.images && work.images.length > 0) {
    thumbnailUrl = work.images[0].url
  }

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    // Use 50% for all works
    const scale = 0.5
    const width = Math.round(img.naturalWidth * scale)
    const height = Math.round(img.naturalHeight * scale)
    setImageDimensions({ width, height })
  }

  const containerStyle: React.CSSProperties = imageDimensions
    ? {
        width: `${imageDimensions.width}px`,
        maxWidth: '100%',
        flexShrink: 0,
      }
    : {
        width: '100%',
      }

  return (
    <div className="flex flex-col work-item-vertical" style={containerStyle}>
      <Link
        to={`/works/${work.id}`}
        className="group block overflow-hidden"
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
        {isAdminMode && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              if (confirm(`Delete "${work.title[language]}"? This will also delete all associated images.`)) {
                onDelete(work.id)
              }
            }}
            className="mt-2 text-[10px] sm:text-xs text-red-500 hover:underline"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

function WorkGrid({
  works,
  language,
  onDelete,
  isAdminMode,
}: {
  works: Work[]
  language: 'en' | 'es'
  onDelete?: (workId: number) => void
  isAdminMode?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-6 sm:gap-8">
      {works.map((work) => (
        <WorkItem 
          key={work.id} 
          work={work} 
          language={language}
          onDelete={onDelete}
          isAdminMode={isAdminMode}
        />
      ))}
    </div>
  )
}

export default function News() {
  const { t, language } = useTranslation()
  const lang = language as 'en' | 'es'
  const isAdminMode = (import.meta as any).env.VITE_ADMIN_MODE === 'true'
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [works, setWorks] = useState<Work[]>([])

  // Load works from portfolioData
  const worksData = portfolioData.works as {
    actress: Work[]
  }
  const performanceWorks = worksData.actress || []

  // Initialize works state
  useEffect(() => {
    const sorted = [...performanceWorks].sort((a, b) => b.year - a.year)
    setWorks(sorted)
  }, [performanceWorks.length])

  const handleDeleteWork = async (workId: number) => {
    try {
      const response = await fetch(`/api/works/${workId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        let message = 'Error deleting work'
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
        alert(message)
        return
      }

      // Remove from local state
      setWorks((prev) => prev.filter((w) => w.id !== workId))
      
      // Reload page to reflect changes
      window.location.reload()
    } catch (error: any) {
      console.error('Delete work error:', error)
      alert(error.message || 'Error deleting work')
    }
  }

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-4 sm:mb-6">
          {t('news.title')}
        </h1>

        {/* Description (editable via translations through admin mode) */}
        <div className="max-w-4xl mb-10 sm:mb-12">
          <EditableText
            dataPath={`news.description.${lang}`}
            language={lang}
            className="text-base sm:text-lg leading-relaxed opacity-90 whitespace-pre-line"
            as="p"
            multiline
          >
            {t('news.description')}
          </EditableText>
        </div>

        {/* Works Grid */}
        {works.length > 0 ? (
          <WorkGrid 
            works={works} 
            language={lang}
            onDelete={handleDeleteWork}
            isAdminMode={isAdminMode}
          />
        ) : (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm opacity-60">
            {t('news.placeholder')}
            {isAdminMode && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 text-sm bg-black text-white rounded hover:opacity-90 transition-opacity"
                >
                  {t('createWork.button')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Create button when works exist */}
        {isAdminMode && works.length > 0 && (
          <div className="mt-8">
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 text-sm bg-black text-white rounded hover:opacity-90 transition-opacity"
            >
              {t('createWork.button')}
            </button>
          </div>
        )}
      </div>

      {showCreateForm && (
        <CreateWorkForm
          category="actress"
          onClose={() => setShowCreateForm(false)}
        />
      )}
    </div>
  )
}

