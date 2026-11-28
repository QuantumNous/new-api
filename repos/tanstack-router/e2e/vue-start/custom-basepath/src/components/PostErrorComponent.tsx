import { ErrorComponent, ErrorComponentProps } from '@tanstack/vue-router'

export function PostErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}
