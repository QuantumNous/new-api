import { useQuery } from '@tanstack/react-query'
import { getCustomOAuthProviders } from '../api'

export function useCustomOAuthProviders() {
  return useQuery({
    queryKey: ['custom-oauth-providers'],
    queryFn: async () => {
      const res = await getCustomOAuthProviders()
      return res.data ?? []
    },
  })
}
