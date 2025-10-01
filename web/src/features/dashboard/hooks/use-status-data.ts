import { useStatus } from '@/hooks/use-status'

/**
 * 获取状态数据中的特定列表
 */
export function useStatusData<T = any>(
  enabledKey: string,
  dataKey: string
): { items: T[]; enabled: boolean; loading: boolean } {
  const { status, loading } = useStatus()
  const enabled = status?.[enabledKey] ?? false
  const items = enabled ? status?.[dataKey] || [] : []

  return { items, enabled, loading }
}

/**
 * 获取 API 信息列表
 */
export function useApiInfo() {
  return useStatusData('api_info_enabled', 'api_info')
}

/**
 * 获取公告列表
 */
export function useAnnouncements() {
  return useStatusData('announcements_enabled', 'announcements')
}

/**
 * 获取 FAQ 列表
 */
export function useFAQ() {
  return useStatusData('faq_enabled', 'faq')
}
