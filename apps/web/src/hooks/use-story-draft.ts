import { useEffect, useState } from 'react'

interface DraftData {
  storyName?: string
  storyContent?: string
}

export function useStoryDraft(
  storageKey: string,
  isCreateMode: boolean,
) {
  // Load draft from localStorage using lazy initialization (create mode only)
  const [storyName, setStoryName] = useState(() => {
    if (!isCreateMode) {
      return ''
    }
    try {
      const draft = localStorage.getItem(storageKey)
      if (draft) {
        const parsed = JSON.parse(draft) as DraftData
        return parsed.storyName ?? ''
      }
    } catch (e) {
      // Ignore localStorage errors
      console.error('Failed to load draft from localStorage:', e)
    }
    return ''
  })

  const [storyContent, setStoryContent] = useState(() => {
    if (!isCreateMode) {
      return ''
    }
    try {
      const draft = localStorage.getItem(storageKey)
      if (draft) {
        const parsed = JSON.parse(draft) as DraftData
        return parsed.storyContent ?? ''
      }
    } catch (e) {
      // Ignore localStorage errors
      console.error('Failed to load draft from localStorage:', e)
    }
    return ''
  })

  const [originalStoryContent, setOriginalStoryContent] = useState(() => {
    if (!isCreateMode) {
      return ''
    }
    try {
      const draft = localStorage.getItem(storageKey)
      if (draft) {
        const parsed = JSON.parse(draft) as DraftData
        return parsed.storyContent ?? ''
      }
    } catch (e) {
      // Ignore localStorage errors
      console.error('Failed to load draft from localStorage:', e)
    }
    return ''
  })

  // Save draft to localStorage whenever content changes (create mode only)
  useEffect(() => {
    if (!isCreateMode) {
      return
    }

    try {
      const draft: DraftData = {
        storyName,
        storyContent,
      }
      localStorage.setItem(storageKey, JSON.stringify(draft))
    } catch (e) {
      // Ignore localStorage errors
      console.error('Failed to save draft to localStorage:', e)
    }
  }, [isCreateMode, storageKey, storyName, storyContent])

  // Clear draft from localStorage
  const clearDraft = () => {
    try {
      localStorage.removeItem(storageKey)
    } catch (e) {
      // Ignore localStorage errors
      console.error('Failed to clear draft from localStorage:', e)
    }
  }

  return {
    storyName,
    setStoryName,
    storyContent,
    setStoryContent,
    originalStoryContent,
    setOriginalStoryContent,
    clearDraft,
  }
}

