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

export default function AssistantDirection() {
  const { t, language } = useTranslation()
  const lang = language as 'en' | 'es'
  const isAdminMode = (import.meta as any).env.VITE_ADMIN_MODE === 'true'
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [works, setWorks] = useState<Work[]>([])
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

  // Handle thumbnail updates
  const handleThumbnailUpdate = (workId: number, newThumbnail: string) => {
    setPortfolioDataState((prev: any) => {
      const updated = { ...prev }
      const worksData = updated.works as { assistantDirection?: Work[] }
      if (Array.isArray(worksData.assistantDirection)) {
        const index = worksData.assistantDirection.findIndex((w: Work) => w.id === workId)
        if (index !== -1) {
          updated.works.assistantDirection[index] = { ...updated.works.assistantDirection[index], thumbnail: newThumbnail }
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
          category: 'assistantDirection',
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
          updated.works.assistantDirection = data.works
          return updated
        })
      }
    } catch (error: any) {
      console.error('Reorder work error:', error)
      alert(error.message || 'Error reordering work')
    }
  }

  // Load works from state (updates when JSON changes)
  useEffect(() => {
    const worksData = portfolioDataState.works as { assistantDirection?: Work[] }
    const assistantWorks = worksData.assistantDirection || []
    // For display, use the order from the array (drag-and-drop order takes precedence)
    setWorks(assistantWorks)
  }, [portfolioDataState])

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
          {t('assistantDirection.title')}
        </h1>

        {/* Description (editable via portfolioData.json) */}
        <div className="max-w-4xl mb-10 sm:mb-12">
          <EditableText
            dataPath={`assistantDirection.description.${lang}`}
            language={lang}
            className="text-base sm:text-lg leading-relaxed opacity-90 whitespace-pre-line"
            as="p"
            multiline
            linkify
          >
            {portfolioDataState?.assistantDirection?.description?.[lang] || ''}
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
            {t('assistantDirection.placeholder')}
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
          category="assistantDirection"
          onClose={() => setShowCreateForm(false)}
        />
      )}
    </div>
  )
}


