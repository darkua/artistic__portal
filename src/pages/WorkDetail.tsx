import React, { useEffect, useState, useRef } from 'react'
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
  
  // All hooks must be declared before any conditional returns
  // Use static import for initial state, update from API responses and HMR
  const [portfolioDataState, setPortfolioDataState] = useState<any>(portfolioData)
  const [isLoadingData, setIsLoadingData] = useState(false)

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
  const [images, setImages] = useState<WorkImage[]>([])
  const [videos, setVideos] = useState<WorkVideo[]>([])
  
  // Image lightbox state
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [favoriteUrls, setFavoriteUrls] = useState<string[]>([])
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)
  
  // Video upload state
  const [showVideoForm, setShowVideoForm] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const [isAddingVideo, setIsAddingVideo] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)

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

  // Fetch latest portfolio data when id changes (especially for newly created works)
  useEffect(() => {
    const fetchLatestData = async () => {
      setIsLoadingData(true)
      try {
        const response = await fetch('/api/portfolio')
        if (response.ok) {
          const data = await response.json()
          setPortfolioDataState(data)
        }
      } catch (error) {
        console.error('Error fetching latest portfolio data:', error)
        // Continue with static data if fetch fails
      } finally {
        setIsLoadingData(false)
      }
    }
    
    // Only fetch if we have an id
    if (id) {
      fetchLatestData()
    }
  }, [id])

  // Scroll to top when navigating to a new work
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
  }, [id])

  // Keyboard navigation for lightbox - must be declared before conditional returns
  useEffect(() => {
    if (!isLightboxOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLightboxOpen(false)
      } else if (event.key === 'ArrowLeft') {
        setActiveImageIndex((prev) => {
          if (!images || images.length === 0) return prev
          return prev === 0 ? images.length - 1 : prev - 1
        })
      } else if (event.key === 'ArrowRight') {
        setActiveImageIndex((prev) => {
          if (!images || images.length === 0) return prev
          return prev === images.length - 1 ? 0 : prev + 1
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLightboxOpen, images])

  // Update images and videos state when work data is available
  // This effect must be declared before conditional returns
  const workIdRef = useRef<number | null>(null)
  useEffect(() => {
    const worksData = portfolioDataState?.works as {
      theaterDirector: Work[]
      actress: Work[]
      movieDirector: Work[]
      assistantDirection?: Work[]
    } | undefined
    
    const allWorks = worksData ? [
      ...(worksData.theaterDirector || []),
      ...(worksData.actress || []),
      ...(worksData.movieDirector || []),
      ...(worksData.assistantDirection || [])
    ] : []
    const foundWork = allWorks.find((w) => w.id === Number(id))
    
    // Only update if work ID changed or work data changed
    if (foundWork && foundWork.id !== workIdRef.current) {
      workIdRef.current = foundWork.id
      setImages(foundWork.images || [])
      const initialVideos: WorkVideo[] = foundWork.videos && foundWork.videos.length > 0
        ? foundWork.videos.filter((v) => v.url && v.url.trim() !== '')
        : []
      setVideos(initialVideos)
    } else if (!foundWork && workIdRef.current !== null) {
      // Reset state when work is not available
      workIdRef.current = null
      setImages([])
      setVideos([])
    }
  }, [portfolioDataState, id])

  // Keyboard navigation for image lightbox - must be declared before conditional returns
  useEffect(() => {
    if (!isLightboxOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsLightboxOpen(false)
      } else if (event.key === 'ArrowLeft') {
        if (!images || images.length === 0) return
        setActiveImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
      } else if (event.key === 'ArrowRight') {
        if (!images || images.length === 0) return
        setActiveImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLightboxOpen, images])

  const worksData = portfolioDataState?.works as {
    theaterDirector: Work[]
    actress: Work[]
    movieDirector: Work[]
    assistantDirection?: Work[]
  } | undefined
  
  // Flatten all works from all categories to find by ID
  const allWorks = worksData ? [
    ...(worksData.theaterDirector || []),
    ...(worksData.actress || []),
    ...(worksData.movieDirector || []),
    ...(worksData.assistantDirection || [])
  ] : []
  const work = allWorks.find((w) => w.id === Number(id))
  
  // Find work's category and index for dataPath
  let workCategory: 'theaterDirector' | 'actress' | 'movieDirector' | 'assistantDirection' | null = null
  let workIndex = -1
  
  if (work && worksData) {
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
    if (workIndex === -1 && worksData.assistantDirection) {
      workIndex = worksData.assistantDirection.findIndex((w) => w.id === Number(id))
      if (workIndex !== -1) {
        workCategory = 'assistantDirection'
      }
    }
  }

  // Show loading state while fetching data for newly created works
  if (isLoadingData) {
    return (
      <div className="w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <p className="text-sm opacity-60">Loading...</p>
        </div>
      </div>
    )
  }

  // Only show "not found" after we've finished loading
  if (!work) {
    return (
      <div className="w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <p>{t('works.notFound')}</p>
          <Link to="/works" className="mt-4 inline-block text-sm hover:opacity-70">
            Back to {t('works.title')}
          </Link>
        </div>
      </div>
    )
  }

  const lang = language as 'en' | 'es'
  const isAdminMode = (import.meta as any).env.VITE_ADMIN_MODE === 'true'

  // Determine back URL based on work category
  const getBackUrl = () => {
    if (workCategory === 'actress') {
      return '/news' // Performance page
    } else if (workCategory === 'assistantDirection') {
      return '/assistant-direction'
    } else {
      return '/works' // Direction page (theaterDirector or movieDirector)
    }
  }

  const getBackLabel = () => {
    if (workCategory === 'actress') {
      return t('news.title') // "PERFORMANCE" or "INTERPRETACIÓN"
    } else if (workCategory === 'assistantDirection') {
      return t('assistantDirection.title') // "ASSISTANT DIRECTOR" or "AYUDANTE DE DIRECCIÓN"
    } else {
      return t('works.title') // "DIRECTION" or "DIRECCIÓN"
    }
  }

  // Fallback to shortDescription if full description doesn't exist
  const description = work?.description?.[lang] || work?.shortDescription?.[lang] || ''
  
  // Use videos state for rendering
  const videoItems: WorkVideo[] = videos

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

      // Update local images state so UI refreshes without page reload
      setImages((prev) => prev.filter((img) => img.url !== imageUrl))
      // Also update portfolioDataState if the API returns updated work data
      try {
        const deleteData = await response.json()
        if (deleteData?.work) {
          setPortfolioDataState((prev: any) => {
            const updated = { ...prev }
            const worksData = updated.works as any
            if (workCategory === 'theaterDirector' && worksData.theaterDirector) {
              const idx = worksData.theaterDirector.findIndex((w: Work) => w.id === work.id)
              if (idx !== -1) worksData.theaterDirector[idx] = deleteData.work
            } else if (workCategory === 'actress' && worksData.actress) {
              const idx = worksData.actress.findIndex((w: Work) => w.id === work.id)
              if (idx !== -1) worksData.actress[idx] = deleteData.work
            } else if (workCategory === 'movieDirector' && worksData.movieDirector) {
              const idx = worksData.movieDirector.findIndex((w: Work) => w.id === work.id)
              if (idx !== -1) worksData.movieDirector[idx] = deleteData.work
            } else if (workCategory === 'assistantDirection' && worksData.assistantDirection) {
              const idx = worksData.assistantDirection.findIndex((w: Work) => w.id === work.id)
              if (idx !== -1) worksData.assistantDirection[idx] = deleteData.work
            }
            return updated
          })
        }
      } catch {
        // If response doesn't have JSON, that's okay
      }
      setIsDeleting(false)
    } catch (error: any) {
      console.error('Image delete error:', error)
      setDeleteError(error.message || 'Error deleting image')
      setIsDeleting(false)
    }
  }

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

  const handleReorderImage = async (imageUrl: string, newIndex: number) => {
    if (!imageUrl || !workCategory || workIndex === -1) return

    setDeleteError(null)

    try {
      const response = await fetch(`/api/works/${work.id}/images/reorder`, {
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
      if (data.images && Array.isArray(data.images)) {
        // Update local images state so UI refreshes without page reload
        setImages(data.images)
        // Also update portfolioDataState if the API returns updated work data
        if (data.work) {
          setPortfolioDataState((prev: any) => {
            const updated = { ...prev }
            const worksData = updated.works as any
            if (workCategory === 'theaterDirector' && worksData.theaterDirector) {
              const idx = worksData.theaterDirector.findIndex((w: Work) => w.id === work.id)
              if (idx !== -1) worksData.theaterDirector[idx] = data.work
            } else if (workCategory === 'actress' && worksData.actress) {
              const idx = worksData.actress.findIndex((w: Work) => w.id === work.id)
              if (idx !== -1) worksData.actress[idx] = data.work
            } else if (workCategory === 'movieDirector' && worksData.movieDirector) {
              const idx = worksData.movieDirector.findIndex((w: Work) => w.id === work.id)
              if (idx !== -1) worksData.movieDirector[idx] = data.work
            } else if (workCategory === 'assistantDirection' && worksData.assistantDirection) {
              const idx = worksData.assistantDirection.findIndex((w: Work) => w.id === work.id)
              if (idx !== -1) worksData.assistantDirection[idx] = data.work
            }
            return updated
          })
        }
      }
    } catch (error: any) {
      console.error('Image reorder error:', error)
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
    console.log('[Drag End] Resetting drag state')
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
    // If mouse is in the left/top half, drop before; otherwise drop after
    const shouldDropBefore = mouseX < centerX || mouseY < centerY
    
    let calculatedDropIndex = index
    if (shouldDropBefore && draggedImageIndex !== null && draggedImageIndex < index) {
      calculatedDropIndex = index
    } else if (!shouldDropBefore && draggedImageIndex !== null && draggedImageIndex > index) {
      calculatedDropIndex = index + 1
    } else if (draggedImageIndex !== null) {
      // If dragging from a different position, adjust accordingly
      if (draggedImageIndex < index) {
        calculatedDropIndex = shouldDropBefore ? index : index + 1
      } else {
        calculatedDropIndex = shouldDropBefore ? index : index + 1
      }
    }
    
    console.log('[Drag Over]', {
      index,
      draggedImageIndex,
      mouseX,
      mouseY,
      centerX,
      centerY,
      shouldDropBefore,
      calculatedDropIndex,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    })
    
    setDropTargetIndex(calculatedDropIndex)
  }

  const handleImageDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('[Drop]', {
      dropIndex,
      draggedImageIndex,
      dropTargetIndex,
      imagesLength: images.length
    })

    if (draggedImageIndex === null) {
      console.log('[Drop] No dragged image, aborting')
      setDraggedImageIndex(null)
      setDropTargetIndex(null)
      return
    }

    // Use dropTargetIndex if available, otherwise use dropIndex
    const finalDropIndex = dropTargetIndex !== null ? dropTargetIndex : dropIndex
    
    if (draggedImageIndex === finalDropIndex) {
      console.log('[Drop] Same position, aborting')
      setDraggedImageIndex(null)
      setDropTargetIndex(null)
      return
    }

    console.log('[Drop] Reordering', {
      from: draggedImageIndex,
      to: finalDropIndex,
      imageUrl: images[draggedImageIndex]?.url
    })

    const image = images[draggedImageIndex]
    if (image) {
      await handleReorderImage(image.url, finalDropIndex)
    }

    setDraggedImageIndex(null)
    setDropTargetIndex(null)
  }

  const handleAddVideo = async () => {
    if (!videoUrl.trim()) {
      setVideoError('Video URL is required')
      return
    }

    // Validate URL is YouTube or Vimeo
    const isYouTube = isYouTubeUrl(videoUrl)
    const isVimeo = isVimeoUrl(videoUrl)
    
    if (!isYouTube && !isVimeo) {
      setVideoError('Please provide a valid YouTube or Vimeo URL')
      return
    }

    setVideoError(null)
    setIsAddingVideo(true)

    try {
      const response = await fetch(`/api/works/${work.id}/videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: videoUrl.trim() }),
      })

      if (!response.ok) {
        let message = 'Error adding video'
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
      if (data.video) {
        setVideos((prev) => [...prev, data.video])
        setVideoUrl('')
        setShowVideoForm(false)
      }
    } catch (error: any) {
      console.error('Add video error:', error)
      setVideoError(error.message || 'Error adding video')
    } finally {
      setIsAddingVideo(false)
    }
  }

  return (
    <div className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Back link */}
        <Link
          to={getBackUrl()}
          className="inline-flex items-center gap-2 text-sm mb-8 hover:opacity-70 transition-opacity"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to {getBackLabel()}</span>
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
          {workCategory !== null && workIndex !== -1 ? (
            <EditableText
              dataPath={`works.${workCategory}[${workIndex}].year`}
              language={lang}
              className="mt-2 text-sm sm:text-base opacity-60"
              as="p"
              noTranslate
            >
              {String(work.year)}
            </EditableText>
          ) : (
            <p className="mt-2 text-sm sm:text-base opacity-60">{work.year}</p>
          )}
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
              linkify
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

        {/* Admin: Add video */}
        {isAdminMode && workCategory !== null && workIndex !== -1 && (
          <div className="mb-8 max-w-5xl">
            {!showVideoForm ? (
              <button
                type="button"
                onClick={() => setShowVideoForm(true)}
                className="px-4 py-2 text-sm bg-black text-white rounded hover:opacity-90 transition-opacity"
              >
                {t('workDetail.addVideo')}
              </button>
            ) : (
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-2">
                    {t('workDetail.videoUrl')}
                  </label>
                  <input
                    type="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                    disabled={isAddingVideo}
                  />
                </div>
                {videoError && (
                  <p className="text-xs text-red-500">{videoError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddVideo}
                    disabled={isAddingVideo || !videoUrl.trim()}
                    className="px-4 py-2 text-xs sm:text-sm bg-black text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isAddingVideo ? 'Adding...' : t('workDetail.add')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowVideoForm(false)
                      setVideoUrl('')
                      setVideoError(null)
                    }}
                    className="px-4 py-2 text-xs sm:text-sm border border-border rounded hover:opacity-70 transition-opacity"
                    disabled={isAddingVideo}
                  >
                    {t('workDetail.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Video gallery – render one or many, stacked */}
        {videoItems.length > 0 && (
          <div className={`mb-12 sm:mb-16 space-y-8 ${workCategory === 'movieDirector' || work?.id === 10 ? 'w-full min-w-[360px] max-w-[800px]' : 'max-w-5xl'}`}>
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

              // For specific works with exactly 2 videos, add titles
              let videoTitle: string | null = null
              if (work?.id === 10 && videoItems.length === 2) {
                // PERSONA: Teaser and Trailer
                videoTitle = index === 0 ? 'Teaser' : 'Trailer'
              } else if (work?.id === 4 && videoItems.length === 2) {
                // Work 4: Trailer and Short Film (with Spanish translations)
                videoTitle = index === 0 
                  ? (lang === 'es' ? 'Tráiler' : 'Trailer')
                  : (lang === 'es' ? 'Cortometraje' : 'Short Film')
              }

              return (
                <div key={index} className="space-y-2">
                  {videoTitle && (
                    <h3 className="text-sm sm:text-base font-light opacity-80">{videoTitle}</h3>
                  )}
                  <div className="aspect-video bg-black">
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
                    {/* Favorite heart in top-right corner */}
                    <button
                      type="button"
                      className="absolute top-1 right-1 z-10 p-1 rounded-full bg-black/40 hover:bg-black/60"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleFavorite(img.url)
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
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
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                      draggable={false}
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
                  </div>
                  {isAdminMode && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-[10px] sm:text-xs text-red-500 hover:underline"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDeleteImage(img.url)
                        }}
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
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

            {/* Image container - full viewport on mobile, constrained on desktop */}
            <div className="relative z-50 w-full h-full sm:max-w-5xl sm:h-auto sm:px-4 flex flex-col">
              {/* Header overlay - positioned on top of image */}
              <div className="absolute top-0 left-0 right-0 z-60 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 to-transparent">
                <span className="text-white text-xs sm:text-sm opacity-90">
                  {activeImageIndex + 1} / {images.length}
                </span>
                <button
                  type="button"
                  className="absolute top-2 right-2 sm:top-4 sm:right-4 z-70 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-white text-xl sm:text-2xl hover:bg-white/20 rounded-full transition-colors border border-white/40"
                  onClick={(e) => {
                    e.stopPropagation()
                    closeLightbox()
                  }}
                  aria-label="Close image gallery"
                  title="Close"
                >
                  ×
                </button>
              </div>

              {/* Image area - constrained to viewport height */}
              <div className="relative w-full h-full sm:aspect-[4/3] sm:h-auto bg-black flex items-center justify-center overflow-hidden" style={{ maxHeight: '100vh' }}>
                <img
                  src={images[activeImageIndex].url}
                  alt={`${work.title[lang]} - ${activeImageIndex + 1}`}
                  className="max-w-full max-h-full w-auto h-auto object-contain"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />

                {/* Navigation buttons - overlaid on image */}
                {images.length > 1 && (
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

              {/* Image caption - overlay at bottom */}
              {images[activeImageIndex].caption &&
                images[activeImageIndex].caption[lang] && (
                  <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-xs sm:text-sm text-white/90 italic text-center">
                      {images[activeImageIndex].caption[lang]}
                    </p>
                  </div>
                )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

