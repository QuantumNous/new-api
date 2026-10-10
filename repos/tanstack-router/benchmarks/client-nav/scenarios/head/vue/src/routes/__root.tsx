import * as Vue from 'vue'
import {
  HeadContent,
  Link,
  Outlet,
  createRootRoute,
} from '@tanstack/vue-router'
import { articleIds, docsSections, rootHead } from '../../../shared'

const RootComponent = Vue.defineComponent({
  setup() {
    return () => (
      <>
        <HeadContent />
        <nav>
          <Link to="/" data-testid="go-home" activeProps={{ class: 'active' }}>
            Home
          </Link>
          {docsSections.map((section) => (
            <Link
              key={section}
              to="/docs/$section"
              params={{ section }}
              data-testid={`go-docs-${section}`}
              activeProps={{ class: 'active' }}
            >
              {`Docs ${section}`}
            </Link>
          ))}
          {articleIds.map((id) => (
            <Link
              key={id}
              to="/articles/$id"
              params={{ id }}
              data-testid={`go-article-${id}`}
              activeProps={{ class: 'active' }}
            >
              {`Article ${id}`}
            </Link>
          ))}
          <Link
            to="/settings"
            data-testid="go-settings"
            activeProps={{ class: 'active' }}
          >
            Settings
          </Link>
        </nav>
        <Outlet />
      </>
    )
  },
})

export const Route = createRootRoute({
  head: rootHead,
  component: RootComponent,
})
