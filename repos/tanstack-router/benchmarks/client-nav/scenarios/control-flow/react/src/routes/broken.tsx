import { createFileRoute } from '@tanstack/react-router'
import { errorMessage } from '../../../shared'
import type { ErrorComponentProps } from '@tanstack/react-router'

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
