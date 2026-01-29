import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import portfolioData from '../data/portfolioData.json'
import { ArrowLeft } from 'lucide-react'
import { isYouTubeUrl, extractYouTubeId, getYouTubeEmbedUrl } from '../utils/youtube'
import EditableText from '../components/EditableText'
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
  
  // Find work's category and index for dataPath
  let workCategory: 'theaterDirector' | 'actress' | 'movieDirector' | null = null
  let workIndex = -1
  
  if (work) {
    if (worksData.theaterDirector) {
      workIndex = worksData.theaterDirector.findIndex((w) => w.id === Number(id))
      if (workIndex !== -1) {
        workCategory = 'theaterDirector'
      }
    }
    if (workIndex === -1 && worksData.actress) {
      workIndex = worksData.actress.findIndex((w) => w.id === Number(id))
      if (workIndex !== -1) {
        workCategory = 'actress'
      }
    }
    if (workIndex === -1 && worksData.movieDirector) {
      workIndex = worksData.movieDirector.findIndex((w) => w.id === Number(id))
      if (workIndex !== -1) {
        workCategory = 'movieDirector'
      }
    }
  }

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
  const isAdminMode = import.meta.env.VITE_ADMIN_MODE === 'true'

  // Fallback to shortDescription if full description doesn't exist
  const description = work.description?.[lang] || work.shortDescription?.[lang] || ''

  // Build a unified list of videos (single or many)
  const videoItems: WorkVideo[] =
    work.videos && work.videos.length > 0
      ? work.videos.filter((v) => v.url && v.url.trim() !== '')
      : []

  // Images state (so uploads/deletes don't require a full page reload)
  const [images, setImages] = useState<WorkImage[]>(work.images || [])

  // Image lightbox state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [favoriteUrls, setFavoriteUrls] = useState<string[]>([])

  const openLightbox = (index: number) => {
    setActiveImageIndex(index)
    setIsLightboxOpen(true)
  }

  const closeLightbox = () => {
    setIsLightboxOpen(false)
  }

  const showPrevImage = () => {
    if (!images || images.length === 0) return
    setActiveImageIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    )
  }

  const showNextImage = () => {
    if (!images || images.length === 0) return
    setActiveImageIndex((prev) =>
      prev === images.length - 1 ? 0 : prev + 1
    )
  }

  // Load favorites so we can show which images are already selected for the hero
  useEffect(() => {
    let isMounted = true
    ;(async () => {
      try {
        const res = await fetch('/api/favorites')
        if (!res.ok) return
        const data = await res.json()
        if (isMounted && Array.isArray(data.favorites)) {
          setFavoriteUrls(data.favorites)
        }
      } catch {
        // ignore
      }
    })()
    return () => {
      isMounted = false
    }
  }, [])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadError(null)
    setIsUploading(true)

    try {
      const newImages: WorkImage[] = []
      // Upload each file individually
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('image', file)

        const response = await fetch(`/api/works/${work.id}/images`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          let message = 'Error uploading image'
          try {
            const data = await response.json()
            if (data && data.error) message = data.error
          } catch {
            // ignore JSON parse errors
          }
          throw new Error(message)
        }

        // Response includes the URL of the newly added image
        const data = await response.json()
        if (data && data.image && data.image.url) {
          newImages.push({
            url: data.image.url,
            caption: {
              en: 'Scene from the play',
              es: 'Escena de la obra',
            },
          })
        }
      }

      if (newImages.length > 0) {
        setImages((prev) => [...prev, ...newImages])
      }
    } catch (error: any) {
      console.error('Image upload error:', error)
      setUploadError(error.message || 'Error uploading images')
    } finally {
      setIsUploading(false)
      // Reset file input so the same files can be re-selected if needed
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  const handleDeleteImage = async (imageUrl: string) => {
    if (!imageUrl || !workCategory || workIndex === -1) return
    if (!confirm('Delete this photo from the gallery? This cannot be undone.')) {
      return
    }

    setDeleteError(null)
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/works/${work.id}/images`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: imageUrl }),
      })

      if (!response.ok) {
        let message = 'Error deleting image'
        try {
          const data = await response.json()
          if (data && data.error) message = data.error
        } catch {
          // ignore
        }
        throw new Error(message)
      }

      // Update local images state so UI refreshes without page reload
      setImages((prev) => prev.filter((img) => img.url !== imageUrl))
      setIsDeleting(false)
    } catch (error: any) {
      console.error('Image delete error:', error)
      setDeleteError(error.message || 'Error deleting image')
      setIsDeleting(false)
    }
  }

  const toggleFavorite = async (imageUrl: string) => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: imageUrl }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.favorites)) {
        setFavoriteUrls(data.favorites)
      }
    } catch {
      // silent fail, UI stays as before
    }
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

        {/* Title + year */}
        <div className="mb-6 sm:mb-8">
          {workCategory !== null && workIndex !== -1 ? (
            <EditableText
              dataPath={`works.${workCategory}[${workIndex}].title`}
              language={lang}
              className="text-4xl sm:text-5xl lg:text-6xl font-light"
              as="h1"
            >
              {work.title[lang]}
            </EditableText>
          ) : (
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light">
              {work.title[lang]}
            </h1>
          )}
          <p className="mt-2 text-sm sm:text-base opacity-60">{work.year}</p>
        </div>

        {/* Main description text */}
        {description && workCategory !== null && workIndex !== -1 ? (
          <div className="max-w-4xl mb-10 sm:mb-12">
            <EditableText
              dataPath={`works.${workCategory}[${workIndex}].description`}
              language={lang}
              className="text-base sm:text-lg leading-relaxed opacity-90 whitespace-pre-line"
              as="p"
              multiline
            >
              {description}
            </EditableText>
          </div>
        ) : description ? (
          <div className="max-w-4xl mb-10 sm:mb-12">
            <p className="text-base sm:text-lg leading-relaxed opacity-90 whitespace-pre-line">
              {description}
            </p>
          </div>
        ) : null}

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

        {/* Admin: upload new photos to the gallery (each uploaded individually, appended at the end) */}
        {isAdminMode && workCategory !== null && workIndex !== -1 && (
          <div className="mb-8 max-w-5xl">
            <label className="block text-xs sm:text-sm font-medium mb-2">
              Upload photos (they will appear at the end of the gallery)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={isUploading}
              className="block text-xs sm:text-sm"
            />
            {uploadError && (
              <p className="mt-2 text-xs text-red-500">
                {uploadError}
              </p>
            )}
          </div>
        )}

        {/* Image thumbnails gallery; click to open full-screen lightbox */}
        {images && images.length > 0 && (
          <div className="mb-12 sm:mb-16">
            {deleteError && (
              <p className="mb-3 text-xs sm:text-sm text-red-500">
                {deleteError}
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              {images.map((img, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center gap-1"
                >
                  <button
                    type="button"
                    className="group relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 overflow-hidden border border-border"
                    onClick={() => openLightbox(index)}
                  >
                    {/* Favorite heart in top-right corner */}
                    <button
                      type="button"
                      className="absolute top-1 right-1 z-10 p-1 rounded-full bg-black/40 hover:bg-black/60"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(img.url)
                      }}
                    >
                      <span
                        className={`text-xs sm:text-sm ${
                          favoriteUrls.includes(img.url)
                            ? 'text-red-500'
                            : 'text-white/70'
                        }`}
                      >
                        ♥
                      </span>
                    </button>
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
                  {isAdminMode && (
                    <button
                      type="button"
                      className="text-[10px] sm:text-xs text-red-500 hover:underline"
                      onClick={() => handleDeleteImage(img.url)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full-screen lightbox for images */}
        {isLightboxOpen && images && images.length > 0 && (
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
                        {activeImageIndex + 1} / {images.length}
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
                  src={images[activeImageIndex].url}
                  alt={`${work.title[lang]} - ${activeImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain"
                />

                {/* Navigation buttons */}
                {images.length > 1 && (
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
                     {images[activeImageIndex].caption &&
                       images[activeImageIndex].caption[lang] && (
                  <p className="mt-3 text-xs sm:text-sm text-white/80 italic text-center">
                           {images[activeImageIndex].caption[lang]}
                  </p>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

