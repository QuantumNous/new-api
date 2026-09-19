import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { sleep } from '../../posts'

export const Route = createFileRoute('/(tests)/issue-7040-target')({
  loader: async () => {
    await sleep(250)
    return null
  },
  component: Component,
})

function Component() {
  return (
    <div className="p-2">
      <div className="grid gap-2">
        <h3>issue-7040-target</h3>
        <p data-testid="issue-7040-target-top">
          Short page that should reset to top on navigation.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        {Array.from({ length: 18 }).map((_, index) => (
          <section
            key={`issue-7040-target-section-${index}`}
            className="min-h-16 rounded border p-3"
          >
            <h4 className="font-medium">Target section {index + 1}</h4>
            <p>This page is intentionally much shorter than the source page.</p>
          </section>
        ))}
      </div>

      <div data-testid="issue-7040-target-bottom" className="py-8">
        Bottom of issue-7040-target
      </div>
    </div>
  )
}
