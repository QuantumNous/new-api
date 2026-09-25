import { ErrorComponent } from '@tanstack/solid-router'
import type { ErrorComponentProps } from '@tanstack/solid-router'

export function PostErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}
