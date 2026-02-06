import { useEditable } from '../hooks/useEditable'

interface EditableTextProps {
  dataPath: string
  language?: 'en' | 'es'
  children: string
  className?: string
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3' | 'div'
  multiline?: boolean
  noTranslate?: boolean // For non-translatable fields like year (plain values, not {en, es} objects)
  linkify?: boolean // Whether to auto-detect and linkify URLs in the text
}

// URL regex pattern - matches http://, https://, and www. URLs
const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi

// Parse text and convert URLs to clickable links
function parseTextWithLinks(text: string): React.ReactNode {
  if (!text) return text
  console.log('parsing text: ', text)
  const parts = text.split(URL_REGEX)
  
  return parts.map((part, index) => {
    if (URL_REGEX.test(part)) {
      // Reset regex lastIndex since we're using 'g' flag
      URL_REGEX.lastIndex = 0
      const href = part.startsWith('http') ? part : `https://${part}`
      return (
        <a
          key={index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      )
    }
    return part
  })
}

// If VITE_API_URL is not set, we use a relative /api base so that Vite can proxy to the backend.
const API_BASE_URL = (import.meta as any).env.VITE_API_URL || ''

async function saveText(dataPath: string, value: string, language?: 'en' | 'es') {
  const base = API_BASE_URL || ''
  const response = await fetch(`${base}/api/portfolio`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: dataPath,
      value,
      language,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to save')
  }

  return response.json()
}

export default function EditableText({
  dataPath,
  language,
  children,
  className = '',
  as: Component = 'span',
  multiline = false,
  noTranslate = false,
  linkify = false,
}: EditableTextProps) {
  // For non-translatable fields, don't pass language to the API
  const effectiveLanguage = noTranslate ? undefined : language
  
  const {
    isEditing,
    value,
    setValue,
    isAdminMode,
    isSaving,
    handleDoubleClick,
    handleSave,
    handleCancel,
    handleKeyDown,
  } = useEditable({
    dataPath,
    language: effectiveLanguage,
    initialValue: children,
    onSave: async (newValue) => {
      await saveText(dataPath, newValue, effectiveLanguage)
      // Reload the page to reflect changes
      window.location.reload()
    },
  })

  if (!isAdminMode) {
    return <Component className={className}>{linkify ? parseTextWithLinks(children) : children}</Component>
  }

  if (isEditing) {
    if (multiline) {
      return (
        <div className={`relative ${className}`}>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full min-h-[120px] p-2 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
            autoFocus
            disabled={isSaving}
          />
          <div className="mt-2 flex gap-2 justify-end text-xs">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="px-2 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1 border border-blue-500 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )
    }

    return (
      <Component className={`relative ${className}`}>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-2 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-300"
          autoFocus
          disabled={isSaving}
        />
        <div className="mt-1 flex gap-2 justify-end text-xs">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="px-2 py-0.5 border border-gray-300 rounded bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-0.5 border border-blue-500 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
          >
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Component>
    )
  }

  return (
    <Component
      className={`${className} ${isAdminMode ? 'cursor-text hover:bg-blue-50 transition-colors' : ''}`}
      onDoubleClick={handleDoubleClick}
      title={isAdminMode ? 'Double-click to edit' : undefined}
    >
      {linkify ? parseTextWithLinks(children) : children}
    </Component>
  )
}

