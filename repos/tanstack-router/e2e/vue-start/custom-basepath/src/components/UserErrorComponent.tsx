import { ErrorComponent } from '@tanstack/vue-router'
import type { ErrorComponentProps } from '@tanstack/vue-router'

export function UserErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}
