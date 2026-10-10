import {
  HeadContent,
  Link,
  Outlet,
  createRootRoute,
} from '@tanstack/react-router'
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
        <Link
          to="/"
          data-testid="go-home"
          activeProps={{ className: 'active' }}
        >
          Home
        </Link>
        {docsSections.map((section) => (
          <Link
            key={section}
            to="/docs/$section"
            params={{ section }}
            data-testid={`go-docs-${section}`}
            activeProps={{ className: 'active' }}
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
            activeProps={{ className: 'active' }}
          >
            {`Article ${id}`}
          </Link>
        ))}
        <Link
          to="/settings"
          data-testid="go-settings"
          activeProps={{ className: 'active' }}
        >
          Settings
        </Link>
      </nav>
      <Outlet />
    </>
  )
}
