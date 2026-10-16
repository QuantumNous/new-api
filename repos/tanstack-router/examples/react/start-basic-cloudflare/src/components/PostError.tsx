import { ErrorComponent } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'

export function PostErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}
