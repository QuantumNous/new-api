import * as React from 'react'
import { PostNotFoundError } from '@router-mono-react-query/post-query'
import {
  useRouter,
  ErrorComponent,
  ErrorComponentProps,
} from '@router-mono-react-query/router'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'

export function PostErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  if (error instanceof PostNotFoundError) {
    return <div>{error.message}</div>
  }
  const queryErrorResetBoundary = useQueryErrorResetBoundary()

  React.useEffect(() => {
    queryErrorResetBoundary.reset()
  }, [queryErrorResetBoundary])

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
