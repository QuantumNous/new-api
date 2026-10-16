import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { ScrollBlock } from '../-components/scroll-block'

export const Route = createFileRoute('/(tests)/ssr-scroll-key')({
  component: Component,
})

function Component() {
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <div className="p-2">
      <h3>ssr-scroll-key</h3>
      {hydrated ? <span data-testid="ssr-scroll-key-hydrated" /> : null}
      <div
        id="ssr-scroll-key-nested"
        data-scroll-restoration-id="ssr-scroll-key-nested"
        data-testid="ssr-scroll-key-nested"
        className="h-24 overflow-auto rounded border p-2"
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i}>Nested SSR row {i}</div>
        ))}
      </div>
      <ScrollBlock />
    </div>
  )
}
