import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import portfolioData from '../data/portfolioData.json'
import { ArrowLeft } from 'lucide-react'
import { isYouTubeUrl, extractYouTubeId, getYouTubeEmbedUrl } from '../utils/youtube'
import { isVimeoUrl, extractVimeoId, getVimeoEmbedUrl } from '../utils/vimeo'

interface WorkImage {
  url: string
  caption: {
    en: string
    es: string
  }
}

interface WorkVideo {
  url: string
  thumbnail: string
}

interface Work {
  id: number
  title: {
    en: string
    es: string
  }
  description?: {
    en: string
    es: string
  }
  shortDescription?: {
    en: string
    es: string
  }
  // Thumbnail for list/grid views
  thumbnail?: string
  // Gallery of images for the detail page
  images?: WorkImage[]
  // Gallery of videos (YouTube or uploaded)
  videos?: WorkVideo[]
  materials?: {
    en: string
    es: string
  }
  size?: {
    en: string
    es: string
  }
  year: number
}

export default function WorkDetail() {
  const { id } = useParams<{ id: string }>()
  const { t, language } = useTranslation()
  const worksData = portfolioData.works as {
    theaterDirector: Work[]
    actress: Work[]
    movieDirector: Work[]
  }
  
  // Flatten all works from all categories to find by ID
  const allWorks = [
    ...(worksData.theaterDirector || []),
    ...(worksData.actress || []),
    ...(worksData.movieDirector || [])
  ]
  const work = allWorks.find((w) => w.id === Number(id))

  if (!work) {
    return (
      <div className="w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <p>{t('works.notFound')}</p>
          <Link to="/works" className="mt-4 inline-block text-sm hover:opacity-70">
            {t('works.backToWorks')}
          </Link>
        </div>
      </div>
    )
  }

  const lang = language as 'en' | 'es'

  // Fallback to shortDescription if full description doesn't exist
  const description = work.description?.[lang] || work.shortDescription?.[lang] || ''

  // Build a unified list of videos (single or many)
  const videoItems: WorkVideo[] =
    work.videos && work.videos.length > 0
      ? work.videos.filter((v) => v.url && v.url.trim() !== '')
      : []

  // Image lightbox state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const openLightbox = (index: number) => {
    setActiveImageIndex(index)
    setIsLightboxOpen(true)
  }

  const closeLightbox = () => {
    setIsLightboxOpen(false)
  }

  const showPrevImage = () => {
    if (!work.images || work.images.length === 0) return
    setActiveImageIndex((prev) =>
      prev === 0 ? work.images!.length - 1 : prev - 1
    )
  }

  const showNextImage = () => {
    if (!work.images || work.images.length === 0) return
    setActiveImageIndex((prev) =>
      prev === work.images!.length - 1 ? 0 : prev + 1
    )
  }

  // Ensure detail page opens scrolled to top when navigated to
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [])

  // Keyboard navigation for image lightbox
  useEffect(() => {
    if (!isLightboxOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeLightbox()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        showPrevImage()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        showNextImage()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLightboxOpen, showPrevImage, showNextImage])

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Back link */}
        <Link
          to="/works"
          className="inline-flex items-center gap-2 text-sm mb-8 hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t('works.backToWorks')}</span>
        </Link>

        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-6 sm:mb-8">
          {work.title[lang]}
        </h1>

        {/* Main description text */}
        {description && (
          <div className="max-w-4xl mb-10 sm:mb-12">
            <p className="text-base sm:text-lg leading-relaxed opacity-90 whitespace-pre-line">
              {description}
            </p>
          </div>
        )}

        {/* Video gallery – render one or many, stacked */}
        {videoItems.length > 0 && (
          <div className="mb-12 sm:mb-16 max-w-5xl space-y-8">
            {videoItems.map((video, index) => {
              const url = video.url.trim()
              const isYouTube = isYouTubeUrl(url)
              const isVimeo = isVimeoUrl(url)
              const youtubeId = isYouTube ? extractYouTubeId(url) : null
              const vimeoId = isVimeo ? extractVimeoId(url) : null
              
              let embedSrc = url
              if (isYouTube && youtubeId) {
                embedSrc = getYouTubeEmbedUrl(youtubeId)
              } else if (isVimeo && vimeoId) {
                embedSrc = getVimeoEmbedUrl(vimeoId)
              }

              return (
                <div key={index} className="aspect-video bg-black">
                  {isYouTube || isVimeo ? (
                    <iframe
                      src={embedSrc}
                      title={`${work.title[lang]} - Video ${index + 1}`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={url}
                      controls
                      className="w-full h-full object-contain"
                      poster={video.thumbnail || undefined}
                    >
                      Your browser does not support the video tag.
                    </video>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Image thumbnails gallery; click to open full-screen lightbox */}
        {work.images && work.images.length > 0 && (
          <div className="mb-12 sm:mb-16">
            <div className="flex flex-wrap gap-4">
              {work.images.map((img, index) => (
                <button
                  key={index}
                  type="button"
                  className="group relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 overflow-hidden border border-border"
                  onClick={() => openLightbox(index)}
                >
                  <img
                    src={img.url}
                    alt={`${work.title[lang]} - ${index + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      const parent = target.parentElement
                      if (parent) {
                        parent.innerHTML = `
                          <div class="w-full h-full bg-gray-200 flex items-center justify-center">
                            <span class="text-gray-400 text-xs">${work.title[lang]}</span>
                          </div>
                        `
                      }
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Full-screen lightbox for images */}
        {isLightboxOpen && work.images && work.images.length > 0 && (
          <div className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center">
            {/* Close area */}
            <button
              type="button"
              className="absolute inset-0 cursor-zoom-out"
              onClick={closeLightbox}
              aria-label="Close image gallery"
            />

            {/* Image container */}
            <div className="relative z-50 max-w-5xl w-full px-4">
              <div className="flex items-center justify-between mb-4 text-white text-xs sm:text-sm opacity-75">
                <span>
                  {activeImageIndex + 1} / {work.images.length}
                </span>
                <button
                  type="button"
                  className="px-2 py-1 border border-white/40 text-xs uppercase tracking-wide"
                  onClick={closeLightbox}
                >
                  Close
                </button>
              </div>

              <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center">
                <img
                  src={work.images[activeImageIndex].url}
                  alt={`${work.title[lang]} - ${activeImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />

                {/* Navigation buttons */}
                {work.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-white text-2xl sm:text-3xl px-2 py-1 bg-black/40 hover:bg-black/60"
                      onClick={showPrevImage}
                      aria-label="Previous image"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-2xl sm:text-3xl px-2 py-1 bg-black/40 hover:bg-black/60"
                      onClick={showNextImage}
                      aria-label="Next image"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>

              {/* Image caption */}
              {work.images[activeImageIndex].caption &&
                work.images[activeImageIndex].caption[lang] && (
                  <p className="mt-3 text-xs sm:text-sm text-white/80 italic text-center">
                    {work.images[activeImageIndex].caption[lang]}
                  </p>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

