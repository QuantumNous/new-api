import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'
import * as React from 'react'

export const Route = createFileRoute('/scroll-restoration')({
  component: ScrollRestorationRoute,
})

function BottomWidget() {
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <section
      data-testid="scroll-restoration-widget"
      data-hydrated={hydrated ? 'true' : 'false'}
      style={{
        minHeight: 900,
        padding: 24,
        border: '2px solid #4f46e5',
        borderRadius: 16,
        background: 'rgba(255, 255, 255, 0.88)',
      }}
    >
      <h2>Bottom widget</h2>
      <p>
        This visible deferred boundary is intentionally near the bottom of the
        document.
      </p>
      <p>
        The hydrated widget is taller than the server skeleton so the test can
        catch scroll restoration that happens before late hydration settles.
      </p>
    </section>
  )
}

function BottomWidgetSkeleton() {
  return (
    <section
      data-testid="scroll-restoration-skeleton"
      style={{
        minHeight: 900,
        padding: 24,
        border: '2px dashed #94a3b8',
        borderRadius: 16,
        background: 'rgba(248, 250, 252, 0.88)',
      }}
    >
      <h2>Bottom widget skeleton</h2>
      <p>
        The server-rendered placeholder reserves the same vertical space as the
        hydrated widget.
      </p>
    </section>
  )
}

function ScrollRestorationRoute() {
  return (
    <section>
      <h1 data-testid="scroll-restoration-heading">
        Scroll restoration deferred hydration
      </h1>
      <p>
        This route keeps the reproduction small: a tall page, a visible Hydrate
        boundary near the bottom, and normal router scroll restoration.
      </p>
      <div
        data-testid="scroll-restoration-spacer"
        style={{
          display: 'grid',
          height: '180vh',
          margin: '24px 0',
          placeItems: 'center',
          border: '1px dashed #818cf8',
          borderRadius: 16,
        }}
      >
        Scroll to the bottom widget
      </div>
      <Hydrate when={visible({ rootMargin: '0px' })}>
        <ClientOnly fallback={<BottomWidgetSkeleton />}>
          <BottomWidget />
        </ClientOnly>
      </Hydrate>
    </section>
  )
}
