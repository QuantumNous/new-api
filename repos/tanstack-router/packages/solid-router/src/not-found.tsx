import { isNotFound } from '@tanstack/router-core'
import * as Solid from 'solid-js'
import { CatchBoundary } from './CatchBoundary'
import { useRouter } from './useRouter'
import type { NotFoundError } from '@tanstack/router-core'

// Solid wraps non-Error throws in an Error and stores the original thrown value
// on `cause`, so component-thrown `notFound()` needs one extra unwrapping step.
export function getNotFound(
  error: unknown,
): (NotFoundError & { isNotFound: true }) | undefined {
  if (isNotFound(error)) {
    return error as NotFoundError & { isNotFound: true }
  }

  if (isNotFound((error as any)?.cause)) {
    return (error as any).cause as NotFoundError & { isNotFound: true }
  }

  return undefined
}

export function CatchNotFound(props: {
  fallback?: (error: NotFoundError) => Solid.JSX.Element
  onCatch?: (error: NotFoundError) => void
  children: Solid.JSX.Element
}) {
  const router = useRouter()
  // TODO: Some way for the user to programmatically reset the not-found boundary?
  const pathname = Solid.createMemo(() => router.stores.location.get().pathname)
  const status = Solid.createMemo(() => router.stores.status.get())

  return (
    <CatchBoundary
      getResetKey={() => `not-found-${pathname()}-${status()}`}
      onCatch={(error) => {
        const notFoundError = getNotFound(error)

        if (notFoundError) {
          props.onCatch?.(notFoundError)
        } else {
          throw error
        }
      }}
      errorComponent={({ error }) => {
        const notFoundError = getNotFound(error)

        if (notFoundError) {
          return props.fallback?.(notFoundError)
        } else {
          throw error
        }
      }}
    >
      {props.children}
    </CatchBoundary>
  )
}

export function DefaultGlobalNotFound() {
  return <p>Not Found</p>
}
