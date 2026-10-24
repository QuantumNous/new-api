import { For } from 'solid-js'
import {
  Link,
  Outlet,
  createRootRoute,
  useMatchRoute,
} from '@tanstack/solid-router'
import {
  itemIds,
  matchProbeIds,
  stepItemIds,
  variantSearch,
} from '../../../shared'

export const Route = createRootRoute({
  component: RootComponent,
})

function StatusPanel() {
  const matchRoute = useMatchRoute()

  return (
    <aside>
      <For each={matchProbeIds}>
        {(id) => (
          <span>
            {matchRoute({ to: '/items/$id', params: { id } })()
              ? `on-${id}`
              : ''}
          </span>
        )}
      </For>
      {/* Static probes use the setup-scoped matchRoute instead of
          <MatchRoute>: vue-router's MatchRoute creates an undisposed watcher
          per render (one leaked subscription per navigation), so all three
          apps use useMatchRoute for cross-framework parity. */}
      <span>{matchRoute({ to: '/' })() ? 'at-home' : ''}</span>
      <span>{matchRoute({ to: '/about' })() ? 'at-about' : ''}</span>
      <span>{matchRoute({ to: '/', fuzzy: true })() ? 'under-root' : ''}</span>
      <span>
        {matchRoute({ to: '/about', fuzzy: true })() ? 'under-about' : ''}
      </span>
      <span>
        {matchRoute({ to: '/about', includeSearch: true })()
          ? 'about-search'
          : ''}
      </span>
    </aside>
  )
}

function LinkGrid() {
  return (
    <div>
      <For each={itemIds}>
        {(id) => (
          <div>
            <Link
              to="/items/$id"
              params={{ id }}
              data-testid={
                stepItemIds.includes(id) ? `go-item-${id}` : undefined
              }
            >
              {`Item ${id}`}
            </Link>
            <Link
              to="/items/$id"
              params={{ id }}
              activeOptions={{ exact: true }}
              activeProps={{ class: 'active-link' }}
              inactiveProps={{ class: 'inactive-link' }}
            >
              {`Item ${id} exact`}
            </Link>
            <Link
              to="/items/$id"
              params={{ id }}
              search={variantSearch}
              activeOptions={{ includeSearch: false }}
            >
              {`Item ${id} search`}
            </Link>
            <Link to="/items/$id" params={{ id }} hash={`section-${id}`}>
              {`Item ${id} hash`}
            </Link>
            <Link
              to="/items/$id"
              params={{ id }}
              activeOptions={{ exact: true }}
            >
              {({ isActive }) =>
                isActive ? `Item ${id} on` : `Item ${id} off`
              }
            </Link>
          </div>
        )}
      </For>
    </div>
  )
}

function RootComponent() {
  return (
    <>
      <nav>
        <Link to="/" data-testid="go-home">
          Home
        </Link>
        <Link to="/about" data-testid="go-about">
          About
        </Link>
      </nav>
      <StatusPanel />
      <LinkGrid />
      <Outlet />
    </>
  )
}
