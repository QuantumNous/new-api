import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getHomePageContent } from '../api'
import type { HomePageContentResult } from '../types'

const STORAGE_KEY = 'home_page_content'

/**
 * Hook to load and manage custom home page content
 * Supports both Markdown/HTML content and iframe URLs
 */
export function useHomePageContent(): HomePageContentResult {
  const [content, setContent] = useState<string>('')
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const loadContent = async () => {
      // Load from localStorage first for immediate display
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        setContent(cached)
      }

      try {
        const response = await getHomePageContent()
        const { success, data } = response

        if (success && data) {
          setContent(data)
          localStorage.setItem(STORAGE_KEY, data)
        } else {
          // Clear content if API returns empty
          setContent('')
          localStorage.removeItem(STORAGE_KEY)
        }
      } catch (error) {
        console.error('Failed to load home page content:', error)
        toast.error('Failed to load home page content')
      } finally {
        setIsLoaded(true)
      }
    }

    loadContent()
  }, [])

  const isUrl = content.startsWith('https://')

  return { content, isLoaded, isUrl }
}
