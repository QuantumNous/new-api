import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { WindowSize } from '~/components/WindowSize'

export const Route = createFileRoute('/client-only')({
  component: ClientOnlyPage,
})

function ClientOnlyPage() {
  return (
    <div className="p-2">
      <h3 data-testid="client-only-heading">Client Only Demo</h3>
      <p>
        The component below uses <code>window</code> APIs that only exist in the
        browser.
      </p>
      <ClientOnly
        fallback={
          <div data-testid="loading-fallback">Loading window size...</div>
        }
      >
        <WindowSize />
      </ClientOnly>
    </div>
  )
}
