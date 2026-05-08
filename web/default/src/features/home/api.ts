import { api } from '@/lib/api'
import type { HomePageContentResponse } from './types'

// ============================================================================
// Home Page APIs
// ============================================================================

/**
 * Get custom home page content
 * Returns Markdown/HTML content or iframe URL
 */
export async function getHomePageContent(): Promise<HomePageContentResponse> {
  const res = await api.get('/api/home_page_content')
  return res.data
}
