import {
  ErrorComponent,
  PostNotFoundError,
} from '@router-solid-mono-simple/router'
import type { ErrorComponentProps } from '@router-solid-mono-simple/router'

export function PostErrorComponent({ error }: ErrorComponentProps) {
  if (error instanceof PostNotFoundError) {
    return <div>Not found from api: {error.message}</div>
  }

  return <ErrorComponent error={error} />
}
