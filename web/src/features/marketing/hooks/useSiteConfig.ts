import { useQuery } from '@tanstack/react-query'

interface SiteConfig {
  system_name?: string
  logo?: string
}

export function useSiteConfig() {
  return useQuery<SiteConfig>({
    queryKey: ['public-site-config'],
    queryFn: async () => {
      const res = await fetch('/api/public/site-config')
      const json = await res.json()
      return json?.data ?? {}
    },
    staleTime: 5 * 60 * 1000,
  })
}
