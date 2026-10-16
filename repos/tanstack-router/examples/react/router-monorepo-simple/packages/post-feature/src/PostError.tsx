import { ErrorComponent, PostNotFoundError } from '@router-mono-simple/router'
import type { ErrorComponentProps } from '@router-mono-simple/router'

export function PostErrorComponent({ error }: ErrorComponentProps) {
  if (error instanceof PostNotFoundError) {
    return <div>Not found from api: {error.message}</div>
  }

  return <ErrorComponent error={error} />
}
