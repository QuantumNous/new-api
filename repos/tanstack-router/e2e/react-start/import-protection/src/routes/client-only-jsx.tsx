import { createFileRoute } from '@tanstack/react-router'
// This import triggers a file-based violation in the SSR env:
//   client-only-jsx.tsx -> violations/window-size.client.tsx (denied by **/*.client.*)
// The binding is used directly in JSX, so the code snippet in the violation
// message will contain JSX — triggering the `<ClientOnly>` suggestion.
import { WindowSize } from '../violations/window-size.client'

export const Route = createFileRoute('/client-only-jsx')({
  component: ClientOnlyJsx,
})

function ClientOnlyJsx() {
  return (
    <div>
      <h1 data-testid="client-only-jsx-heading">Client-Only JSX</h1>
      <p data-testid="window-size">
        Window:{' '}
        <strong>
          <WindowSize />
        </strong>
      </p>
    </div>
  )
}
