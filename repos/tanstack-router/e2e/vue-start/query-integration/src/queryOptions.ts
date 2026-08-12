import { queryOptions } from '@tanstack/vue-query'

export const makeQueryOptions = (key: string) =>
  queryOptions({
    queryKey: ['e2e-test-query-integration', key],
    queryFn: async () => {
      console.log('fetching query data')
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 500)
      })
      const result = typeof window !== 'undefined' ? 'client' : 'server'
      console.log('query data result', result)
      return result
    },
    staleTime: Infinity,
  })
