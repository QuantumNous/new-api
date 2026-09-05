import { For } from 'solid-js'
import {
  HeadContent,
  Link,
  Outlet,
  createRootRoute,
} from '@tanstack/solid-router'
import { articleIds, docsSections, rootHead } from '../../../shared'

export const Route = createRootRoute({
  head: rootHead,
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <HeadContent />
      <nav>
        <Link to="/" data-testid="go-home" activeProps={{ class: 'active' }}>
          Home
        </Link>
        <For each={docsSections}>
          {(section) => (
            <Link
              to="/docs/$section"
              params={{ section }}
              data-testid={`go-docs-${section}`}
              activeProps={{ class: 'active' }}
            >
              {`Docs ${section}`}
            </Link>
          )}
        </For>
        <For each={articleIds}>
          {(id) => (
            <Link
              to="/articles/$id"
              params={{ id }}
              data-testid={`go-article-${id}`}
              activeProps={{ class: 'active' }}
            >
              {`Article ${id}`}
            </Link>
          )}
        </For>
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
}
