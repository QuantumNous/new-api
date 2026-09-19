import { ErrorComponent, ErrorComponentProps } from '@tanstack/solid-router'

export function UserErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}
