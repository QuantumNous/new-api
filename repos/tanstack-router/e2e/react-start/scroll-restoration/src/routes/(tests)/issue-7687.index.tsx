import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(tests)/issue-7687/')({
  component: Component,
})

const visitKey = 'issue-7687-list-visits'

function ResetProbe() {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    const visits = Number(window.sessionStorage.getItem(visitKey) ?? 0)
    window.sessionStorage.setItem(visitKey, String(visits + 1))

    if (visits > 0 && ref.current) {
      ref.current.scrollTop = 80
    }
  }, [])

  return (
    <div
      ref={ref}
      id="issue-7687-reset-probe"
      data-testid="issue-7687-reset-probe"
      className="h-24 overflow-auto rounded border p-2"
    >
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i}>Reset probe row {i}</div>
      ))}
    </div>
  )
}

function Component() {
  return (
    <div className="grid gap-4">
      <h3>issue-7687-list</h3>
      <ResetProbe />
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i}>List row {i}</div>
      ))}
    </div>
  )
}
