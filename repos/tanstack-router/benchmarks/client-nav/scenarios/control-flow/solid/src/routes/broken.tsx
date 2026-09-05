import { createFileRoute } from '@tanstack/solid-router'
import { errorMessage } from '../../../shared'
import type { ErrorComponentProps } from '@tanstack/solid-router'

export const Route = createFileRoute('/broken')({
  staleTime: 0,
  gcTime: 0,
  loader: () => {
    throw new Error(errorMessage)
  },
  errorComponent: BrokenError,
})

function BrokenError(props: ErrorComponentProps) {
  return <div data-testid="error-state">{props.error.message}</div>
}
