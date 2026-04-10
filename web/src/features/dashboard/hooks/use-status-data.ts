import { useStatus } from '@/hooks/use-status'

/**
 * Get specific list from status data
 */
export function useStatusData<T = unknown>(
  enabledKey: string,
  dataKey: string
): { items: T[]; loading: boolean } {
  const { status, loading } = useStatus()
  const enabled = status?.[enabledKey] ?? false
  const items = enabled ? status?.[dataKey] || [] : []

  return { items, loading }
}

/**
 * Get API info list
 */
export function useApiInfo() {
  return useStatusData('api_info_enabled', 'api_info')
}

/**
 * Get announcements list
 */
export function useAnnouncements() {
  return useStatusData('announcements_enabled', 'announcements')
}

/**
 * Get FAQ list
 */
export function useFAQ() {
  return useStatusData('faq_enabled', 'faq')
}
