import {
  createFileRoute,
  useLoaderData,
  useSearch,
} from '@tanstack/react-router'

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, any>) => ({
    q: search.q as string | undefined,
    game: search.game as string | undefined,
    set: search.set as string | undefined,
    rarity: search.rarity as string | undefined,
    page: Number(search.page) || 1,
    limit: 24,
    sort: search.sort,
    order: search.order,
    minPrice: search.minPrice ? Number(search.minPrice) : undefined,
    maxPrice: search.maxPrice ? Number(search.maxPrice) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    return Promise.resolve(deps)
  },
  component: SearchPage,
})

function SearchPage() {
  const q = useSearch({
    from: '/search',
    select: (s) => (s as any).q,
  })
  const page = useLoaderData({
    from: '/search',
    select: (d: any) => d.page,
  })
  return (
    <div>
      <p>q: {q as any}</p>
      <p>page: {page as any}</p>
    </div>
  )
}
