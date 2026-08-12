import {
  ErrorComponent,
  type ErrorComponentProps,
} from '@tanstack/solid-router'

export function DefaultCatchBoundary(props: ErrorComponentProps) {
  return <ErrorComponent {...props} />
}
