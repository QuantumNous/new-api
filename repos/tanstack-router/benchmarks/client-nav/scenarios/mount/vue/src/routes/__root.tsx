import * as Vue from 'vue'
import { Link, Outlet, createRootRoute } from '@tanstack/vue-router'

const RootComponent = Vue.defineComponent({
  setup() {
    return () => (
      <>
        <nav>
          <Link to="/" activeProps={{ class: 'active' }}>
            Home
          </Link>
          <Link to="/shop" activeProps={{ class: 'active' }}>
            Shop
          </Link>
          <Link
            to="/shop/$productId"
            params={{ productId: '1' }}
            activeProps={{ class: 'active' }}
          >
            Product 1
          </Link>
          <Link to="/blog" activeProps={{ class: 'active' }}>
            Blog
          </Link>
          <Link
            to="/search"
            search={{ q: '', page: 1 }}
            activeProps={{ class: 'active' }}
          >
            Search
          </Link>
          <Link to="/about" activeProps={{ class: 'active' }}>
            About
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
