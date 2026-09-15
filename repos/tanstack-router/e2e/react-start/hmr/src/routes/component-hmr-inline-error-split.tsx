import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/component-hmr-inline-error-split')({
  codeSplitGroupings: [['errorComponent']],
  component: () => {
    const [count, setCount] = useState(0)

    return (
      <main className="hmr-card flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="hmr-label">Inline error split route</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-[var(--color-night)]">
              Inline component with split error boundary
            </h1>
          </div>
          <p className="hmr-marker" data-testid="component-hmr-marker">
            component-hmr-inline-error-split-baseline
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
          <div className="hmr-stat min-w-40">
            <p className="hmr-label">Counter</p>
            <p
              className="mt-2 text-2xl font-bold text-[var(--color-night)]"
              data-testid="component-hmr-count"
            >
              Count: {count}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              className="hmr-button w-full sm:w-fit"
              data-testid="component-hmr-increment"
              onClick={() => setCount((value) => value + 1)}
            >
              Increment
            </button>
            <input
              className="hmr-input"
              data-testid="component-hmr-message"
              defaultValue=""
              placeholder="Component-local uncontrolled state"
            />
          </div>
        </div>
      </main>
    )
  },
  errorComponent: ComponentHmrError,
})

function ComponentHmrError() {
  return (
    <div className="hmr-card border-[var(--color-coral)]/30 bg-[rgba(255,122,89,0.10)] text-[var(--color-night)]">
      <p className="hmr-label">Error component</p>
      <p
        className="mt-2 text-lg font-semibold"
        data-testid="component-hmr-error"
      >
        component-hmr-error
      </p>
    </div>
  )
}
