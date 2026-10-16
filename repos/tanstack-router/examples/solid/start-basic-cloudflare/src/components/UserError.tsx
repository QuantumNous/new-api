import { ErrorComponent } from '@tanstack/solid-router'
import type { ErrorComponentProps } from '@tanstack/solid-router'

export function UserErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}
