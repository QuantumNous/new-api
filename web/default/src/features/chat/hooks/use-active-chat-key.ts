import { useQuery } from '@tanstack/react-query'
import { fetchTokenKey, getApiKeys } from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'
import { useAuthStore } from '@/stores/auth-store'

export async function fetchActiveChatKey() {
  const result = await getApiKeys({ p: 1, size: 50 })
  if (!result.success) {
    throw new Error(result.message || 'Failed to load API keys')
  }

  const items = result.data?.items ?? []
  const active = items.find((item) => item.status === API_KEY_STATUS.ENABLED)
  if (!active) {
    throw new Error('No enabled API keys found. Create or enable one first.')
  }

  const keyResult = await fetchTokenKey(active.id)
  if (!keyResult.success || !keyResult.data?.key) {
    throw new Error(keyResult.message || 'Failed to load API key')
  }

  return `sk-${keyResult.data.key}`
}

/**
 * Get the currently active API key for chat links
 */
export function useActiveChatKey(enabled: boolean) {
  const userId = useAuthStore((state) => state.auth.user?.id)

  return useQuery({
    queryKey: ['chat-active-key', userId],
    queryFn: fetchActiveChatKey,
    enabled: enabled && Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
