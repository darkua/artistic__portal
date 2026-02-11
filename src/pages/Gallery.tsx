import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from '../hooks/useTranslation'
import portfolioData from '../data/portfolioData.json'

// Helper functions for YouTube video detection
function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)/.test(url)
}

function getYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

function getYouTubeThumbnail(url: string): string {
  const videoId = getYouTubeVideoId(url)
  return videoId ? `http://i3.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''
}

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || ''

// ------------------------------------------------------------------
// Inline Editable Gallery Title
// ------------------------------------------------------------------
interface EditableGalleryTitleProps {
  imageUrl: string
  title: string
  language: 'en' | 'es'
  isAdminMode: boolean
  onSave: (imageUrl: string, title: string, language: 'en' | 'es') => Promise<void>
  className?: string
  placeholderClass?: string
  /** If true we're inside the lightbox – different styling */
  lightbox?: boolean
}

function EditableGalleryTitle({
  imageUrl,
  title,
  language,
  isAdminMode,
  onSave,
  className = '',
  placeholderClass = '',
  lightbox = false,
}: EditableGalleryTitleProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(title)
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep local value in sync with prop
  useEffect(() => {
    if (!isEditing) setValue(title)
  }, [title, isEditing])

  // Auto-focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = useCallback(async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await onSave(imageUrl, value, language)
    } catch (err) {
      console.error('Error saving gallery title:', err)
    } finally {
      setIsSaving(false)
      setIsEditing(false)
    }
  }, [imageUrl, value, language, onSave, isSaving])

  const handleCancel = () => {
    setValue(title)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  // Non-admin: just show title (or nothing)
  if (!isAdminMode) {
    if (!title) return null
    return <span className={className}>{title}</span>
  }

  // Admin – editing mode
  if (isEditing) {
    return (
      <span
        className={`inline-flex items-center gap-1 ${className}`}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={`px-1 py-0.5 border border-blue-500 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-300 ${
            lightbox
              ? 'bg-black/60 text-white placeholder:text-white/50 w-64'
              : 'bg-white text-black w-full max-w-[8rem] sm:max-w-[10rem]'
          }`}
          placeholder="Enter title…"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleSave()
          }}
          disabled={isSaving}
          className="text-[10px] px-1 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isSaving ? '…' : '✓'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleCancel()
          }}
          disabled={isSaving}
          className="text-[10px] px-1 py-0.5 bg-gray-400 text-white rounded hover:bg-gray-500"
        >
          ✕
        </button>
      </span>
    )
  }

  // Admin – display mode (click or double-click to edit)
  const displayText = title || (lightbox ? 'Click to add title' : 'Add title')
  return (
    <span
      className={`${title ? className : placeholderClass || className} cursor-text hover:bg-blue-50/30 transition-colors rounded px-0.5`}
      onClick={(e) => {
        e.stopPropagation()
        setIsEditing(true)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setIsEditing(true)
      }}
      title="Click to edit title"
    >
      {displayText}
    </span>
  )
}

// ------------------------------------------------------------------
// Gallery Page
// ------------------------------------------------------------------
export default function Gallery() {
  const { t, language } = useTranslation()
  const isAdminMode = (import.meta as any).env.VITE_ADMIN_MODE === 'true'
  const [portfolioDataState, setPortfolioDataState] = useState<any>(portfolioData)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [galleryTitles, setGalleryTitles] = useState<Record<string, { en: string; es: string }>>({})
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isUploadingGallery, setIsUploadingGallery] = useState(false)
  const [uploadGalleryError, setUploadGalleryError] = useState<string | null>(null)
  const [favoriteUrls, setFavoriteUrls] = useState<string[]>([])
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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

  // Load gallery images and titles from state
  useEffect(() => {
    const gallery = portfolioDataState?.newsPage?.gallery
    if (Array.isArray(gallery)) {
      setGalleryImages(gallery)
    } else {
      setGalleryImages([])
    }
    const titles = portfolioDataState?.newsPage?.galleryTitles
    if (titles && typeof titles === 'object') {
      setGalleryTitles(titles)
    }
  }, [portfolioDataState])

  // Save a gallery title via the API
  const saveGalleryTitle = useCallback(async (imageUrl: string, title: string, lang: 'en' | 'es') => {
    const base = API_BASE_URL || ''
    const response = await fetch(`${base}/api/news/gallery/title`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl, title, language: lang }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.error || 'Failed to save title')
    }
    const data = await response.json()
    // Update local state with new titles
    if (data.galleryTitles) {
      setGalleryTitles(data.galleryTitles)
      setPortfolioDataState((prev: any) => ({
        ...prev,
        newsPage: { ...prev.newsPage, galleryTitles: data.galleryTitles },
      }))
    } else {
      // Optimistic update
      setGalleryTitles((prev) => ({
        ...prev,
        [imageUrl]: {
          ...(prev[imageUrl] || { en: '', es: '' }),
          [lang]: title,
        },
      }))
    }
  }, [])

  // Helper to get a gallery item's title for the current language
  const getGalleryTitle = useCallback((imageUrl: string): string => {
    const entry = galleryTitles[imageUrl]
    if (!entry) return ''
    return entry[language] || ''
  }, [galleryTitles, language])

  // Load favorites so we can show which images are already selected for the hero
  // Skip API calls in production (static mode)
  useEffect(() => {
    if ((import.meta as any).env?.PROD) return // Static mode, skip API
    
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

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!isLightboxOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeLightbox()
      } else if (event.key === 'ArrowLeft') {
        if (!galleryImages || galleryImages.length === 0) return
        setActiveImageIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1))
      } else if (event.key === 'ArrowRight') {
        if (!galleryImages || galleryImages.length === 0) return
        setActiveImageIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLightboxOpen, galleryImages])

  // Gallery handlers
  const toggleFavorite = async (imageUrl: string) => {
    if ((import.meta as any).env?.PROD) return // Static mode, skip API
    
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

  const handleDeleteGalleryImage = async (imageUrl: string) => {
    if (!imageUrl) return
    if (!confirm('Delete this photo from the gallery? This cannot be undone.')) {
      return
    }

    setDeleteError(null)
    setIsDeleting(true)

    try {
      const response = await fetch('/api/news/gallery', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: imageUrl }),
      })

      if (!response.ok) {
        let message = 'Error deleting image'
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

      // Update local gallery images state
      setGalleryImages((prev) => prev.filter((url) => url !== imageUrl))
      // Update portfolioDataState
      setPortfolioDataState((prev: any) => {
        const updated = { ...prev }
        if (!updated.newsPage) updated.newsPage = {}
        if (Array.isArray(updated.newsPage.gallery)) {
          updated.newsPage.gallery = updated.newsPage.gallery.filter((url: string) => url !== imageUrl)
        }
        return updated
      })
      setIsDeleting(false)
    } catch (error: any) {
      console.error('Gallery image delete error:', error)
      setDeleteError(error.message || 'Error deleting image')
      setIsDeleting(false)
    }
  }

  const handleReorderGalleryImage = async (imageUrl: string, newIndex: number) => {
    if (!imageUrl) return

    setDeleteError(null)

    try {
      const response = await fetch('/api/news/gallery/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl, newIndex }),
      })

      if (!response.ok) {
        let message = 'Error reordering image'
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
      if (data.gallery && Array.isArray(data.gallery)) {
        // Update local gallery images state
        setGalleryImages(data.gallery)
        // Update portfolioDataState
        setPortfolioDataState((prev: any) => {
          const updated = { ...prev }
          if (!updated.newsPage) updated.newsPage = {}
          updated.newsPage.gallery = data.gallery
          return updated
        })
      }
    } catch (error: any) {
      console.error('Gallery image reorder error:', error)
      setDeleteError(error.message || 'Error reordering image')
    }
  }

  const handleImageDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation()
    setDraggedImageIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', index.toString())
  }

  const handleImageDragEnd = () => {
    setDraggedImageIndex(null)
    setDropTargetIndex(null)
  }

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    
    // Calculate drop position based on mouse position within the element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mouseX = e.clientX
    const mouseY = e.clientY
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    
    // Determine if we should drop before or after this index
    const shouldDropBefore = mouseX < centerX || mouseY < centerY
    
    let calculatedDropIndex = index
    if (shouldDropBefore && draggedImageIndex !== null && draggedImageIndex < index) {
      calculatedDropIndex = index
    } else if (!shouldDropBefore && draggedImageIndex !== null && draggedImageIndex > index) {
      calculatedDropIndex = index + 1
    } else if (draggedImageIndex !== null) {
      if (draggedImageIndex < index) {
        calculatedDropIndex = shouldDropBefore ? index : index + 1
      } else {
        calculatedDropIndex = shouldDropBefore ? index : index + 1
      }
    }
    
    setDropTargetIndex(calculatedDropIndex)
  }

  const handleImageDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    if (draggedImageIndex === null || draggedImageIndex === dropIndex) {
      setDraggedImageIndex(null)
      setDropTargetIndex(null)
      return
    }

    const imageUrl = galleryImages[draggedImageIndex]
    if (imageUrl) {
      // Use dropTargetIndex if available, otherwise use dropIndex
      const finalDropIndex = dropTargetIndex !== null ? dropTargetIndex : dropIndex
      await handleReorderGalleryImage(imageUrl, finalDropIndex)
    }

    setDraggedImageIndex(null)
    setDropTargetIndex(null)
  }

  const openLightbox = (index: number) => {
    setActiveImageIndex(index)
    setIsLightboxOpen(true)
  }

  const closeLightbox = () => {
    setIsLightboxOpen(false)
  }

  const showPrevImage = () => {
    if (!galleryImages || galleryImages.length === 0) return
    setActiveImageIndex((prev) =>
      prev === 0 ? galleryImages.length - 1 : prev - 1
    )
  }

  const showNextImage = () => {
    if (!galleryImages || galleryImages.length === 0) return
    setActiveImageIndex((prev) =>
      prev === galleryImages.length - 1 ? 0 : prev + 1
    )
  }

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* Title */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-8 sm:mb-12">
          {t('gallery.title')}
        </h1>

        {/* Admin: Upload gallery images */}
        {isAdminMode && (
          <div className="mb-8 max-w-5xl">
            <label className="block text-xs sm:text-sm font-medium mb-2">
              Upload photos (they will appear at the end of the gallery)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={async (e) => {
                const files = e.target.files
                if (!files || files.length === 0) return

                setIsUploadingGallery(true)
                setUploadGalleryError(null)

                try {
                  const newImages: string[] = []
                  for (const file of Array.from(files)) {
                    const formData = new FormData()
                    formData.append('image', file)

                    const response = await fetch('/api/news/gallery', {
                      method: 'POST',
                      body: formData,
                    })

                    if (!response.ok) {
                      throw new Error('Error uploading image')
                    }

                    const data = await response.json()
                    if (data.url) {
                      newImages.push(data.url)
                    }
                  }

                  if (newImages.length > 0) {
                    setGalleryImages((prev) => [...prev, ...newImages])
                    // Update portfolioDataState
                    setPortfolioDataState((prev: any) => {
                      const updated = { ...prev }
                      if (!updated.newsPage) updated.newsPage = {}
                      if (!Array.isArray(updated.newsPage.gallery)) updated.newsPage.gallery = []
                      updated.newsPage.gallery = [...updated.newsPage.gallery, ...newImages]
                      return updated
                    })
                  }
                } catch (error: any) {
                  console.error('Gallery upload error:', error)
                  setUploadGalleryError(error.message || 'Error uploading images')
                } finally {
                  setIsUploadingGallery(false)
                  if (e.target) {
                    e.target.value = ''
                  }
                }
              }}
              disabled={isUploadingGallery}
              className="block text-xs sm:text-sm"
            />
            {uploadGalleryError && (
              <p className="mt-2 text-xs text-red-500">{uploadGalleryError}</p>
            )}
          </div>
        )}

        {/* Image thumbnails gallery; click to open full-screen lightbox */}
        {galleryImages && galleryImages.length > 0 && (
          <div className="mb-12 sm:mb-16">
            {deleteError && (
              <p className="mb-3 text-xs sm:text-sm text-red-500">
                {deleteError}
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              {galleryImages.map((imgUrl, index) => {
                const itemTitle = getGalleryTitle(imgUrl)
                return (
                  <div
                    key={index}
                    className={`flex flex-col items-center gap-1 ${draggedImageIndex === index ? 'opacity-50' : ''}`}
                    onDragOver={(e) => handleImageDragOver(e, index)}
                    onDrop={(e) => handleImageDrop(e, index)}
                  >
                    <div
                      className={`group relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 overflow-hidden border border-border ${isAdminMode ? 'cursor-move' : 'cursor-pointer'}`}
                      draggable={isAdminMode}
                      onDragStart={(e) => handleImageDragStart(e, index)}
                      onDragEnd={handleImageDragEnd}
                      onClick={() => {
                        // Only open lightbox if not in admin mode or if not dragging
                        if (!isAdminMode || draggedImageIndex === null) {
                          openLightbox(index)
                        }
                      }}
                    >
                      {/* Favorite heart in top-right corner (admin only) */}
                      {isAdminMode && (
                        <button
                          type="button"
                          className="absolute top-1 right-1 z-10 p-1 rounded-full bg-black/40 hover:bg-black/60"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(imgUrl)
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <span
                            className={`text-xs sm:text-sm ${
                              favoriteUrls.includes(imgUrl)
                                ? 'text-red-500'
                                : 'text-white/70'
                            }`}
                          >
                            ♥
                          </span>
                        </button>
                      )}
                      {isYouTubeUrl(imgUrl) ? (
                        <>
                          <img
                            src={getYouTubeThumbnail(imgUrl)}
                            alt={itemTitle || `Video ${index + 1}`}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                            draggable={false}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              const videoId = getYouTubeVideoId(imgUrl)
                              if (videoId && target.src.includes('maxresdefault')) {
                                target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                              }
                            }}
                          />
                          {/* Play button overlay */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                        </>
                      ) : (
                        <img
                          src={imgUrl}
                          alt={itemTitle || `Gallery image ${index + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                          draggable={false}
                          onError={(e) => {
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            const parent = target.parentElement
                            if (parent) {
                              parent.innerHTML = `
                                <div class="w-full h-full bg-gray-200 flex items-center justify-center">
                                  <span class="text-gray-400 text-xs">Gallery image</span>
                                </div>
                              `
                            }
                          }}
                        />
                      )}
                    </div>
                    {/* Title below thumbnail */}
                    {(itemTitle || isAdminMode) && (
                      <div className="w-24 sm:w-28 lg:w-32 text-center">
                        <EditableGalleryTitle
                          imageUrl={imgUrl}
                          title={itemTitle}
                          language={language}
                          isAdminMode={isAdminMode}
                          onSave={saveGalleryTitle}
                          className="text-[10px] sm:text-xs text-foreground/70 leading-tight line-clamp-2"
                          placeholderClass="text-[10px] sm:text-xs text-foreground/30 italic leading-tight"
                        />
                      </div>
                    )}
                    {isAdminMode && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-[10px] sm:text-xs text-red-500 hover:underline"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteGalleryImage(imgUrl)
                          }}
                          disabled={isDeleting}
                        >
                          {isDeleting ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {galleryImages.length === 0 && !isAdminMode && (
          <div className="border border-dashed border-border rounded-lg p-8 text-center text-sm opacity-60">
            {t('gallery.placeholder')}
          </div>
        )}
      </div>

      {/* Full-screen lightbox for gallery images */}
      {isLightboxOpen && galleryImages && galleryImages.length > 0 && (
        <div className="fixed inset-0 z-40 bg-black/90 flex items-center justify-center">
          {/* Close area */}
          <button
            type="button"
            className="absolute inset-0 cursor-zoom-out"
            onClick={closeLightbox}
            aria-label="Close image gallery"
          />

          {/* Image container - centered, auto height so bar stays above photo */}
          <div className="relative z-50 w-full max-h-full sm:max-w-5xl px-2 sm:px-4 flex flex-col items-stretch" style={{ maxHeight: '96vh' }}>
            {/* Top bar – counter + close button, above the photo */}
            <div className="flex-shrink-0 flex items-center justify-between px-1 pb-1.5 sm:pb-2">
              <span className="text-white text-[10px] sm:text-xs opacity-80">
                {activeImageIndex + 1} / {galleryImages.length}
              </span>
              <button
                type="button"
                className="flex items-center gap-1 px-1.5 py-0.5 sm:px-2 sm:py-1 text-white text-[10px] sm:text-xs bg-white/10 hover:bg-white/20 transition-colors border border-white/25 rounded-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  closeLightbox()
                }}
                aria-label="Close image gallery"
              >
                <span className="text-xs sm:text-sm leading-none">×</span>
                <span>{language === 'es' ? 'Cerrar' : 'Close'}</span>
              </button>
            </div>

            {/* Image/Video area - fills remaining space */}
            <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
              {isYouTubeUrl(galleryImages[activeImageIndex]) ? (
                <div className="w-full h-full flex items-center justify-center">
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(galleryImages[activeImageIndex])}?autoplay=1&rel=0`}
                    title="Video player"
                    className="w-full h-full max-w-4xl aspect-video"
                    style={{ maxHeight: '80vh' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <img
                  src={galleryImages[activeImageIndex]}
                  alt={getGalleryTitle(galleryImages[activeImageIndex]) || `Gallery image ${activeImageIndex + 1}`}
                  className="max-w-full max-h-full w-auto h-auto object-contain"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />
              )}

              {/* Navigation buttons - overlaid on image */}
              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white text-3xl sm:text-4xl px-3 py-2 sm:px-4 sm:py-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation()
                      showPrevImage()
                    }}
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white text-3xl sm:text-4xl px-3 py-2 sm:px-4 sm:py-3 bg-black/50 hover:bg-black/70 rounded-full transition-colors touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation()
                      showNextImage()
                    }}
                    aria-label="Next image"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {/* Title overlay at the bottom of the lightbox */}
            {(() => {
              const activeUrl = galleryImages[activeImageIndex]
              const activeTitle = getGalleryTitle(activeUrl)
              if (!activeTitle && !isAdminMode) return null
              return (
                <div className="absolute bottom-0 left-0 right-0 z-60 bg-gradient-to-t from-black/80 to-transparent px-4 py-3 sm:py-4 flex justify-center">
                  <EditableGalleryTitle
                    imageUrl={activeUrl}
                    title={activeTitle}
                    language={language}
                    isAdminMode={isAdminMode}
                    onSave={saveGalleryTitle}
                    className="text-white text-sm sm:text-base font-light"
                    placeholderClass="text-white/40 text-sm sm:text-base italic"
                    lightbox
                  />
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
