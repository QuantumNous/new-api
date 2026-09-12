import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

export const Route = createFileRoute('/remountDeps')({
  validateSearch(search: { searchParam: string }) {
    return { searchParam: search.searchParam }
  },
  loaderDeps(opts) {
    return opts.search
  },
  component: Home,
  remountDeps(opts) {
    return opts.search
  },
})

let counter = 0

function Home() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  const [mounts, setMounts] = React.useState(counter)
  React.useEffect(() => {
    setMounts(++counter)
  }, [])

  return (
    <div className="p-2">
      <button
        onClick={() => {
          navigate({
            search: { searchParam: Math.random().toString(36).substring(2, 8) },
          })
        }}
      >
        Regenerate search param
      </button>

      <div>Search: {search.searchParam}</div>
      <div data-testid="component-mounts">Page component mounts: {mounts}</div>
    </div>
  )
}
