import { createFileRoute } from '@tanstack/react-router'

export const queryOptions = { staleTime: 5000, gcTime: 10000 }

export const Route = createFileRoute('/query')({
  loader: async () => {
    return { staleTime: queryOptions.staleTime }
  },
  component: () => <div>GC: {queryOptions.gcTime}</div>,
})
