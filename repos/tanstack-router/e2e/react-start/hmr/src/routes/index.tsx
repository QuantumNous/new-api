import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [count, setCount] = useState(0)

  return (
    <main className="hmr-card flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="hmr-label">Home route</p>
          <h1
            className="mt-2 font-display text-3xl font-bold text-[var(--color-night)]"
            data-testid="heading"
          >
            HMR State Test
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            This page checks that local component state and uncontrolled input
            values survive component refreshes.
          </p>
        </div>
        <p className="hmr-marker" data-testid="marker">
          baseline
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-start">
        <div className="hmr-stat min-w-40">
          <p className="hmr-label">Counter</p>
          <p
            className="mt-2 text-2xl font-bold text-[var(--color-night)]"
            data-testid="count"
          >
            Count: {count}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            className="hmr-button w-full sm:w-fit"
            data-testid="increment"
            onClick={() => setCount((d) => d + 1)}
          >
            Increment
          </button>
          <input
            className="hmr-input"
            data-testid="message"
            defaultValue=""
            placeholder="Type something to verify state survives HMR"
          />
        </div>
      </div>
    </main>
  )
}
