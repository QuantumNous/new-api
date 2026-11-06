import * as Vue from 'vue'
import { Link, Outlet, createRootRoute } from '@tanstack/vue-router'

const RootComponent = Vue.defineComponent({
  setup() {
    return () => (
      <>
        <nav>
          <Link to="/" data-testid="go-home">
            Home
          </Link>
          <Link
            to="/sec-a/$id"
            params={{ id: 'item 11%' }}
            data-testid="go-sec-a-id"
          >
            Sec A item
          </Link>
          <Link to="/sec-f/settings" data-testid="go-sec-f-settings">
            Sec F settings
          </Link>
          <Link
            to="/files/$"
            params={{ _splat: 'x/ü y/z' }}
            data-testid="go-files"
          >
            Files
          </Link>
          <Link
            to="/release/v{$version}"
            params={{ version: '9' }}
            data-testid="go-release"
          >
            Release
          </Link>
          <Link to="/alpha" data-testid="go-alpha">
            Alpha
          </Link>
          <Link to="/promo" data-testid="go-promo">
            Promo
          </Link>
          <Link
            to="/sec-c/$id"
            params={{ id: 'q&a+42' }}
            data-testid="go-sec-c-id"
          >
            Sec C item
          </Link>
          <Link to="/sec-d/about" data-testid="go-sec-d-about">
            Sec D about
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
