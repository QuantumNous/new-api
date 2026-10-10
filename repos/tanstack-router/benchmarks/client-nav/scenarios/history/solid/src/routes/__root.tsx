import {
  Link,
  Outlet,
  createRootRoute,
  useBlocker,
  useCanGoBack,
  useLocation,
} from '@tanstack/solid-router'
import { maskedPhotoId, shouldBlockFn } from '../../../shared'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const pathname = useLocation({ select: (location) => location.pathname })
  const canGoBack = useCanGoBack()

  useBlocker({ shouldBlockFn })

  return (
    <>
      <nav>
        <span data-testid="loc">{pathname()}</span>
        <button data-testid="can-go-back" disabled={!canGoBack()}>
          Back
        </button>
        <Link
          to="/pages/$n"
          params={{ n: '1' }}
          data-testid="p-1"
          activeProps={{ class: 'active' }}
        >
          Page 1
        </Link>
        <Link
          to="/pages/$n"
          params={{ n: '2' }}
          data-testid="p-2"
          activeProps={{ class: 'active' }}
        >
          Page 2
        </Link>
        <Link
          to="/pages/$n"
          params={{ n: '3' }}
          replace
          data-testid="p-3-replace"
          activeProps={{ class: 'active' }}
        >
          Page 3 (replace)
        </Link>
        <Link
          to="/photos/$photoId"
          params={{ photoId: maskedPhotoId }}
          mask={{ to: '/gallery' }}
          data-testid="photo-masked"
          activeProps={{ class: 'active' }}
        >
          Photo (masked)
        </Link>
      </nav>
      <Outlet />
    </>
  )
}
