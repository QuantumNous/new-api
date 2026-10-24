import * as Vue from 'vue'
import { Link, Outlet, createRootRoute } from '@tanstack/vue-router'
import { sections } from '../../../shared'

const RootComponent = Vue.defineComponent({
  setup() {
    return () => (
      <>
        <nav>
          <Link to="/" data-testid="go-home">
            Home
          </Link>
          {sections.map((section) => (
            <Link
              key={section}
              to="/sections/$section"
              params={{ section }}
              data-testid={`s-${section}`}
            >
              {`Section ${section}`}
            </Link>
          ))}
          <Link to="/docs" data-testid="go-docs">
            Docs
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
