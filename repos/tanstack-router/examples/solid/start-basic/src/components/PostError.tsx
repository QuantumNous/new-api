import { ErrorComponent, ErrorComponentProps } from '@tanstack/solid-router'

export function PostErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}
