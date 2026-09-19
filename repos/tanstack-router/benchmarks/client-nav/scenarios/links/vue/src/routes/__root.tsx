import * as Vue from 'vue'
import {
  Link,
  Outlet,
  createRootRoute,
  useMatchRoute,
} from '@tanstack/vue-router'
import {
  itemIds,
  matchProbeIds,
  stepItemIds,
  variantSearch,
} from '../../../shared'

const StatusPanel = Vue.defineComponent({
  setup() {
    const matchRoute = useMatchRoute()
    const probes = matchProbeIds.map((id) => ({
      id,
      match: matchRoute({ to: '/items/$id', params: { id } }),
    }))
    // Static probes use the setup-scoped matchRoute instead of <MatchRoute>:
    // vue-router's MatchRoute creates an undisposed watcher per render (one
    // leaked subscription per navigation), so all three apps use
    // useMatchRoute for cross-framework parity.
    const atHome = matchRoute({ to: '/' })
    const atAbout = matchRoute({ to: '/about' })
    const underRoot = matchRoute({ to: '/', fuzzy: true })
    const underAbout = matchRoute({ to: '/about', fuzzy: true })
    const aboutSearch = matchRoute({ to: '/about', includeSearch: true })

    return () => (
      <aside>
        {probes.map(({ id, match }) => (
          <span key={id}>{match.value ? `on-${id}` : ''}</span>
        ))}
        <span>{atHome.value ? 'at-home' : ''}</span>
        <span>{atAbout.value ? 'at-about' : ''}</span>
        <span>{underRoot.value ? 'under-root' : ''}</span>
        <span>{underAbout.value ? 'under-about' : ''}</span>
        <span>{aboutSearch.value ? 'about-search' : ''}</span>
      </aside>
    )
  },
})

const LinkGrid = Vue.defineComponent({
  setup() {
    return () => (
      <div>
        {itemIds.map((id) => (
          <div key={id}>
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
              {({ isActive }: { isActive: boolean }) =>
                isActive ? `Item ${id} on` : `Item ${id} off`
              }
            </Link>
          </div>
        ))}
      </div>
    )
  },
})

const RootComponent = Vue.defineComponent({
  setup() {
    return () => (
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
  },
})

export const Route = createRootRoute({
  component: RootComponent,
})
