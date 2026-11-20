// import { createEffect } from 'solid-js'
import { PostNotFoundError } from '@router-solid-mono-solid-query/post-query'
// import { useQueryErrorResetBoundary } from '@tanstack/solid-query'
import {
  ErrorComponent,
  useRouter,
} from '@router-solid-mono-solid-query/router'
import type { ErrorComponentProps } from '@router-solid-mono-solid-query/router'

export function PostErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  if (error instanceof PostNotFoundError) {
    return <div>{error.message}</div>
  }

  return (
    <div>
      <button
        onClick={() => {
          router.invalidate()
        }}
      >
        retry
      </button>
      <ErrorComponent error={error} />
    </div>
  )
}
