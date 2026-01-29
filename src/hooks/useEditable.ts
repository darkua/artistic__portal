import { useState, useCallback, useEffect } from 'react'

interface UseEditableOptions {
  dataPath: string
  language?: 'en' | 'es'
  initialValue: string
  onSave?: (value: string) => Promise<void>
}

export function useEditable({ dataPath, language, initialValue, onSave }: UseEditableOptions) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(initialValue)
  const [isSaving, setIsSaving] = useState(false)
  const [isAdminMode, setIsAdminMode] = useState(false)

  // Check if admin mode is enabled
  useEffect(() => {
    const adminMode = import.meta.env.VITE_ADMIN_MODE === 'true'
    setIsAdminMode(adminMode)
  }, [])

  // Update value when initialValue changes
  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const handleDoubleClick = useCallback(() => {
    if (isAdminMode) {
      setIsEditing(true)
    }
  }, [isAdminMode])

  const handleSave = useCallback(async () => {
    if (onSave) {
      setIsSaving(true)
      try {
        await onSave(value)
        setIsEditing(false)
      } catch (error) {
        console.error('Error saving:', error)
        alert('Error saving changes. Please try again.')
      } finally {
        setIsSaving(false)
      }
    }
  }, [value, onSave])

  const handleCancel = useCallback(() => {
    setValue(initialValue)
    setIsEditing(false)
  }, [initialValue])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    },
    [handleSave, handleCancel]
  )

  return {
    isEditing,
    value,
    setValue,
    isAdminMode,
    isSaving,
    handleDoubleClick,
    handleSave,
    handleCancel,
    handleKeyDown,
  }
}

