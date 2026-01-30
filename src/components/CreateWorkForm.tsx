import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { X } from 'lucide-react'

interface CreateWorkFormProps {
  category: 'actress' | 'assistantDirection'
  onClose: () => void
}

export default function CreateWorkForm({ category, onClose }: CreateWorkFormProps) {
  const { t, language } = useTranslation()
  const lang = language as 'en' | 'es'
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validation
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!year || isNaN(Number(year))) {
      setError('Valid year is required')
      return
    }
    if (!description.trim()) {
      setError('Description is required')
      return
    }
    if (!thumbnail) {
      setError('Thumbnail image is required')
      return
    }

    setIsSubmitting(true)

    try {
      // Upload thumbnail first
      const formData = new FormData()
      formData.append('thumbnail', thumbnail)

      const uploadRes = await fetch('/api/works/thumbnail', {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        let errorMessage = 'Failed to upload thumbnail'
        try {
          const contentType = uploadRes.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const data = await uploadRes.json()
            errorMessage = data.error || errorMessage
          } else {
            errorMessage = `Server error: ${uploadRes.status} ${uploadRes.statusText}`
          }
        } catch {
          errorMessage = `Server error: ${uploadRes.status} ${uploadRes.statusText}`
        }
        throw new Error(errorMessage)
      }

      const uploadData = await uploadRes.json()

      // Create the work
      const createRes = await fetch('/api/works', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category,
          title: {
            [lang]: title,
          },
          year: Number(year),
          description: {
            [lang]: description,
          },
          thumbnail: uploadData.url,
        }),
      })

      if (!createRes.ok) {
        let errorMessage = 'Failed to create work'
        try {
          const contentType = createRes.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const data = await createRes.json()
            errorMessage = data.error || errorMessage
          } else {
            errorMessage = `Server error: ${createRes.status} ${createRes.statusText}`
          }
        } catch {
          errorMessage = `Server error: ${createRes.status} ${createRes.statusText}`
        }
        throw new Error(errorMessage)
      }

      const workData = await createRes.json()
      
      // Navigate to the new work's detail page
      navigate(`/works/${workData.work.id}`)
    } catch (err: any) {
      console.error('Create work error:', err)
      setError(err.message || 'Error creating work')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-xl font-light">
            {category === 'actress' 
              ? t('createWork.title.performance') 
              : t('createWork.title.assistant')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:opacity-70 transition-opacity"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Year <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min="1900"
              max={new Date().getFullYear() + 1}
              className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-border rounded focus:outline-none focus:ring-1 focus:ring-gray-400 resize-y"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Thumbnail Image <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  setThumbnail(file)
                }
              }}
              className="w-full text-sm"
              required
              disabled={isSubmitting}
            />
            {thumbnail && (
              <p className="mt-2 text-xs text-gray-500">
                Selected: {thumbnail.name}
              </p>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded hover:opacity-70 transition-opacity"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-black text-white rounded hover:opacity-90 transition-opacity disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Work'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

