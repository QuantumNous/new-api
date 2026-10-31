import { ErrorComponent, type ErrorComponentProps } from '@tanstack/vue-router'

export function DefaultCatchBoundary(props: ErrorComponentProps) {
  return <ErrorComponent {...props} />
}
