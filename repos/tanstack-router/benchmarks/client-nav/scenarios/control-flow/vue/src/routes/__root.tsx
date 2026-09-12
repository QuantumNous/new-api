import * as Vue from 'vue'
import {
  Link,
  Outlet,
  createRootRoute,
  useLocation,
} from '@tanstack/vue-router'

const LocationMarker = Vue.defineComponent({
  setup() {
    const pathname = useLocation({ select: (location) => location.pathname })
    return () => <span data-testid="loc">{pathname.value}</span>
  },
})

const RootComponent = Vue.defineComponent({
  setup() {
    return () => (
      <>
        <LocationMarker />
        <nav>
          <Link to="/" data-testid="home">
            Home
          </Link>
          <Link to="/hop1" data-testid="go-hop1">
            Redirect chain
          </Link>
          <Link
            to="/missing/$id"
            params={{ id: 'exists' }}
            data-testid="go-missing-ok"
          >
            Missing ok
          </Link>
          <Link
            to="/missing/$id"
            params={{ id: 'gone' }}
            data-testid="go-missing-gone"
          >
            Missing gone
          </Link>
          <Link to="/broken" data-testid="go-broken">
            Broken
          </Link>
          <Link to="/target" data-testid="go-target">
            Target
          </Link>
        </nav>
        <Outlet />
      </>
    )
  },
})

export const Route = createRootRoute({
  component: RootComponent,
})
