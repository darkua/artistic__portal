import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import EditableText from '../components/EditableText'
import CreateWorkForm from '../components/CreateWorkForm'
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
  onThumbnailUpdate,
  index,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isAnyDragging,
}: {
  work: Work
  language: 'en' | 'es'
  onDelete?: (workId: number) => void
  isAdminMode?: boolean
  onThumbnailUpdate?: (workId: number, newThumbnail: string) => void
  index: number
  isDragging: boolean
  onDragStart: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (e: React.DragEvent, index: number) => void
  isAnyDragging: boolean
  isDropTarget?: boolean
}) {
  const [showThumbnailModal, setShowThumbnailModal] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  let thumbnailUrl = work.thumbnail
  if (!thumbnailUrl && work.images && work.images.length > 0) {
    thumbnailUrl = work.images[0].url
  }

  // Fixed width for all thumbnails (same as Direction page)
  const fixedWidth = 360 // Fixed width in pixels for consistent sizing

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
      <div 
        className={`flex flex-col work-item-vertical ${isDragging ? 'opacity-50' : ''} ${isAdminMode ? 'cursor-move' : ''}`}
        style={{ width: `${fixedWidth}px`, maxWidth: '100%', flexShrink: 0 }}
        draggable={isAdminMode}
        onDragStart={(e) => {
          e.stopPropagation()
          onDragStart(e, index)
        }}
        onDragEnd={(e) => {
          e.stopPropagation()
          onDragEnd()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDragOver(e, index)
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDrop(e, index)
        }}
      >
        <div className="relative">
          <Link
            to={`/works/${work.id}`}
            className="group block overflow-hidden"
            style={{ width: '100%' }}
            onClick={(e) => {
              // Prevent navigation when any item is being dragged
              if (isAdminMode && isAnyDragging) {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
            onDragStart={(e) => {
              // Prevent link from interfering with drag
              if (isAdminMode) {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
            draggable={false}
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
  onDelete,
  isAdminMode,
  onThumbnailUpdate,
  onReorder,
}: {
  works: Work[]
  language: 'en' | 'es'
  onDelete?: (workId: number) => void
  isAdminMode?: boolean
  onThumbnailUpdate?: (workId: number, newThumbnail: string) => void
  onReorder?: (workId: number, newIndex: number) => void
}) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    console.log('[Drag Start]', { index, workId: works[index]?.id, workTitle: works[index]?.title[language] })
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', index.toString())
  }

  const handleDragEnd = () => {
    console.log('[Drag End] Resetting drag state')
    setDraggedIndex(null)
    setDropTargetIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    
    if (draggedIndex === null) return
    
    // Find the container element (the flex-wrap div)
    const container = (e.currentTarget as HTMLElement).closest('.flex.flex-wrap')
    if (!container) {
      setDropTargetIndex(index)
      return
    }
    
    const mouseX = e.clientX
    const mouseY = e.clientY
    
    // Get all work item wrapper divs (the direct children of container)
    // These are in array order (works.map order)
    const containerChildren = Array.from(container.children) as HTMLElement[]
    
    // Create a mapping of visual positions (sorted by top, then left) to array indices
    const itemsWithIndices = containerChildren.map((child, arrayIndex) => {
      const rect = child.getBoundingClientRect()
      return {
        element: child,
        arrayIndex,
        top: rect.top,
        left: rect.left,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      }
    })
    
    // Sort by visual position (top first, then left)
    itemsWithIndices.sort((a, b) => {
      const topDiff = a.top - b.top
      if (Math.abs(topDiff) > 10) return topDiff // Different rows
      return a.left - b.left // Same row, sort by left
    })
    
    // Find which visual position the mouse is over
    let targetVisualIndex = -1
    let foundTarget = false
    
    for (let i = 0; i < itemsWithIndices.length; i++) {
      const item = itemsWithIndices[i]
      const childRect = item.element.getBoundingClientRect()
      const isMouseOver = mouseX >= childRect.left && mouseX <= childRect.right &&
                         mouseY >= childRect.top && mouseY <= childRect.bottom
      
      if (isMouseOver) {
        // Determine if we should drop before or after based on mouse position
        const shouldDropBefore = mouseX < item.centerX || mouseY < item.centerY
        
        if (shouldDropBefore) {
          // Drop before this visual position
          targetVisualIndex = i
        } else {
          // Drop after this visual position - use the next visual position
          targetVisualIndex = i + 1
        }
        
        foundTarget = true
        break
      }
    }
    
    // If we didn't find a target, find the closest visual position
    if (!foundTarget) {
      let closestVisualIndex = 0
      let closestDistance = Infinity
      
      for (let i = 0; i < itemsWithIndices.length; i++) {
        const item = itemsWithIndices[i]
        const distance = Math.sqrt(Math.pow(mouseX - item.centerX, 2) + Math.pow(mouseY - item.centerY, 2))
        
        if (distance < closestDistance) {
          closestDistance = distance
          closestVisualIndex = i
        }
      }
      
      targetVisualIndex = closestVisualIndex
    }
    
    // Convert visual index back to array index
    // targetVisualIndex is the position in the sorted visual order where we want to drop
    let targetArrayIndex: number
    if (targetVisualIndex >= itemsWithIndices.length) {
      // Dropping at the end - use the last item's array index + 1
      const lastItem = itemsWithIndices[itemsWithIndices.length - 1]
      targetArrayIndex = lastItem.arrayIndex + 1
    } else if (targetVisualIndex <= 0) {
      // Dropping at the beginning
      targetArrayIndex = 0
    } else {
      // Use the array index of the item at the target visual position
      const targetItem = itemsWithIndices[targetVisualIndex]
      targetArrayIndex = targetItem.arrayIndex
    }
    
    // Calculate the final drop index accounting for the dragged item
    // The backend removes the item first, then inserts at newIndex
    // So if dragging from 3 to 7, after removing 3, what was 7 is now 6
    let calculatedDropIndex = targetArrayIndex
    if (draggedIndex !== null && draggedIndex < targetArrayIndex) {
      // Dragging forward: after removal, indices shift down by 1
      calculatedDropIndex = targetArrayIndex - 1
    }
    // If dragging backward, targetArrayIndex is already correct (no shift needed)
    
    // Clamp to valid range
    calculatedDropIndex = Math.max(0, Math.min(calculatedDropIndex, works.length - 1))
    
    console.log('[Drag Over]', {
      index,
      draggedIndex,
      targetVisualIndex,
      targetArrayIndex,
      calculatedDropIndex,
      mouseX: mouseX.toFixed(0),
      mouseY: mouseY.toFixed(0),
      containerChildrenCount: containerChildren.length,
      worksLength: works.length,
      visualOrder: itemsWithIndices.map((item, i) => ({ visualPos: i, arrayIndex: item.arrayIndex, workId: works[item.arrayIndex]?.id }))
    })
    
    setDropTargetIndex(calculatedDropIndex)
  }

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('[Drop]', {
      dropIndex,
      draggedIndex,
      dropTargetIndex,
      worksLength: works.length,
      draggedWorkId: draggedIndex !== null ? works[draggedIndex]?.id : null
    })

    if (draggedIndex === null || !onReorder) {
      console.log('[Drop] No dragged item or onReorder missing, aborting')
      setDraggedIndex(null)
      setDropTargetIndex(null)
      return
    }

    // Use dropTargetIndex if available, otherwise use dropIndex
    const finalDropIndex = dropTargetIndex !== null ? dropTargetIndex : dropIndex
    
    if (draggedIndex === finalDropIndex) {
      console.log('[Drop] Same position, aborting')
      setDraggedIndex(null)
      setDropTargetIndex(null)
      return
    }

    console.log('[Drop] Reordering', {
      from: draggedIndex,
      to: finalDropIndex,
      workId: works[draggedIndex]?.id,
      workTitle: works[draggedIndex]?.title[language]
    })

    const work = works[draggedIndex]
    if (work) {
      await onReorder(work.id, finalDropIndex)
    }

    setDraggedIndex(null)
    setDropTargetIndex(null)
  }

  return (
    <div className="flex flex-wrap gap-6 sm:gap-8">
      {works.map((work, index) => {
        // Show drop indicator before this item if dropTargetIndex equals this index
        const showDropIndicatorBefore = dropTargetIndex === index && draggedIndex !== null && draggedIndex !== index
        // Show drop indicator after this item if dropTargetIndex equals index + 1
        const showDropIndicatorAfter = dropTargetIndex === index + 1 && draggedIndex !== null
        // Show blue overlay on the item if it's the drop target
        const showDropIndicator = dropTargetIndex === index && draggedIndex !== null && draggedIndex !== index
        
        return (
          <div key={work.id} className="relative">
            {/* Drop indicator line before this item */}
            {showDropIndicatorBefore && (
              <div className="absolute -left-3 top-0 bottom-0 w-1 bg-blue-500 z-10 rounded shadow-lg" style={{ left: '-12px' }} />
            )}
            <WorkItem 
              work={work} 
              language={language}
              onDelete={onDelete}
              isAdminMode={isAdminMode}
              onThumbnailUpdate={onThumbnailUpdate}
              index={index}
              isDragging={draggedIndex === index}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              isAnyDragging={draggedIndex !== null}
              isDropTarget={showDropIndicator}
            />
            {/* Drop indicator line after this item */}
            {showDropIndicatorAfter && (
              <div className="absolute -right-3 top-0 bottom-0 w-1 bg-blue-500 z-10 rounded shadow-lg" style={{ right: '-12px' }} />
            )}
            {/* Blue overlay on the item itself when it's the drop target */}
            {showDropIndicator && (
              <div className="absolute inset-0 border-4 border-blue-500 z-10 pointer-events-none rounded shadow-lg" />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function News() {
  const { t, language } = useTranslation()
  const lang = language as 'en' | 'es'
  const isAdminMode = (import.meta as any).env.VITE_ADMIN_MODE === 'true'
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [works, setWorks] = useState<Work[]>([])
  const [portfolioDataState, setPortfolioDataState] = useState<any>(portfolioData)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
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

  // Load works from state (updates when JSON changes)
  useEffect(() => {
    const worksData = portfolioDataState.works as { actress: Work[] }
    const performanceWorks = worksData.actress || []
    // For display, use the order from the array (drag-and-drop order takes precedence)
    setWorks(performanceWorks)
  }, [portfolioDataState])

  // Load gallery images from state
  useEffect(() => {
    const gallery = portfolioDataState?.newsPage?.gallery
    if (Array.isArray(gallery)) {
      setGalleryImages(gallery)
    } else {
      setGalleryImages([])
    }
  }, [portfolioDataState])

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

  // Handle thumbnail updates
  const handleThumbnailUpdate = (workId: number, newThumbnail: string) => {
    setPortfolioDataState((prev: any) => {
      const updated = { ...prev }
      const worksData = updated.works as { actress?: Work[] }
      if (Array.isArray(worksData.actress)) {
        const index = worksData.actress.findIndex((w: Work) => w.id === workId)
        if (index !== -1) {
          updated.works.actress[index] = { ...updated.works.actress[index], thumbnail: newThumbnail }
        }
      }
      return updated
    })
  }

  // Handle work reordering
  const handleReorder = async (workId: number, newIndex: number) => {
    try {
      const response = await fetch('/api/works/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'actress',
          workId,
          newIndex,
        }),
      })

      if (!response.ok) {
        let message = 'Error reordering work'
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

      const data = await response.json()
      if (data.works) {
        // Update local state with reordered works
        setPortfolioDataState((prev: any) => {
          const updated = { ...prev }
          updated.works.actress = data.works
          return updated
        })
      }
    } catch (error: any) {
      console.error('Reorder work error:', error)
      alert(error.message || 'Error reordering work')
    }
  }

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

  // Gallery handlers (same as WorkDetail)
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
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light mb-4 sm:mb-6">
          {t('news.title')}
        </h1>

        {/* Description (editable via portfolioData.json) */}
        <div className="max-w-4xl mb-10 sm:mb-12">
          <EditableText
            dataPath={`newsPage.description.${lang}`}
            language={lang}
            className="text-base sm:text-lg leading-relaxed opacity-90 whitespace-pre-line"
            as="p"
            multiline
            linkify
          >
            {portfolioDataState?.newsPage?.description?.[lang] || ''}
          </EditableText>
        </div>

        {/* Works Grid */}
          {works.length > 0 ? (
            <WorkGrid
              works={works}
              language={lang}
              onDelete={handleDeleteWork}
              isAdminMode={isAdminMode}
              onThumbnailUpdate={handleThumbnailUpdate}
              onReorder={handleReorder}
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

        {/* Photo Gallery Section */}
        {(galleryImages.length > 0 || isAdminMode) && (
          <div className="mt-12 sm:mt-16 mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-light mb-6 sm:mb-8">
              {t('news.gallery')}
            </h2>

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
                  {galleryImages.map((imgUrl, index) => (
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
                        {isYouTubeUrl(imgUrl) ? (
                          <>
                            <img
                              src={getYouTubeThumbnail(imgUrl)}
                              alt={`Video ${index + 1}`}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                              draggable={false}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                // Fallback to hqdefault if maxresdefault fails
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
                            alt={`Gallery image ${index + 1}`}
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
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateForm && (
        <CreateWorkForm
          category="actress"
          onClose={() => setShowCreateForm(false)}
        />
      )}

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

          {/* Image container - full viewport on mobile, constrained on desktop */}
          <div className="relative z-50 w-full h-full sm:max-w-5xl sm:h-auto sm:px-4 flex flex-col">
            {/* Header overlay - positioned on top of image */}
            <div className="absolute top-0 left-0 right-0 z-60 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 to-transparent">
              <span className="text-white text-xs sm:text-sm opacity-90">
                {activeImageIndex + 1} / {galleryImages.length}
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

            {/* Image/Video area - constrained to viewport height */}
            <div className="relative w-full h-full sm:aspect-[4/3] sm:h-auto bg-black flex items-center justify-center overflow-hidden" style={{ maxHeight: '100vh' }}>
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
                  alt={`Gallery image ${activeImageIndex + 1}`}
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
          </div>
        </div>
      )}
    </div>
  )
}

