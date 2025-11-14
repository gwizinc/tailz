import { useEffect, useState } from 'react'

interface DraftData {
  storyName?: string
  storyContent?: string
}

export function useStoryDraft(
  storageKey: string,
  isCreateMode: boolean,
) {
  const [storyName, setStoryName] = useState('')
  const [storyContent, setStoryContent] = useState('')
  const [originalStoryContent, setOriginalStoryContent] = useState('')

  // Load draft from localStorage on mount (create mode only)
  useEffect(() => {
    if (!isCreateMode) {
      return
    }

    try {
      const draft = localStorage.getItem(storageKey)
      if (draft) {
        const parsed = JSON.parse(draft) as DraftData
        if (parsed.storyName) {
          setStoryName(parsed.storyName)
        }
        if (parsed.storyContent) {
          setStoryContent(parsed.storyContent)
          setOriginalStoryContent(parsed.storyContent)
        }
      }
    } catch (e) {
      // Ignore localStorage errors
      console.error('Failed to load draft from localStorage:', e)
    }
  }, [isCreateMode, storageKey])

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

