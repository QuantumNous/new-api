import { useQuery } from '@tanstack/react-query'
import { getApiKeys } from '@/features/keys/api'
import { API_KEY_STATUS } from '@/features/keys/constants'

/**
 * Get the currently active API key for chat links
 */
export function useActiveChatKey(enabled: boolean) {
  return useQuery({
    queryKey: ['chat-active-key'],
    queryFn: async () => {
      const result = await getApiKeys({ p: 1, size: 50 })
      if (!result.success) {
        throw new Error(result.message || 'Failed to load API keys')
      }
      const items = result.data?.items ?? []
      const active = items.find(
        (item) => item.status === API_KEY_STATUS.ENABLED
      )
      if (!active) {
        throw new Error(
          'No enabled API keys found. Create or enable one first.'
        )
      }
      return active.key
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
