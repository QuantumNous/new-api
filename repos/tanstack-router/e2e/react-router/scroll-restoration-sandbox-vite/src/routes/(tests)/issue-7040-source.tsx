import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(tests)/issue-7040-source')({
  component: Component,
})

const sectionCount = 180

function Component() {
  return (
    <div className="p-2">
      <div className="grid gap-2">
        <h3>issue-7040-source</h3>
        <p data-testid="issue-7040-source-top">
          Tall page for reproducing the scroll restoration race.
        </p>
      </div>

      <Link
        to="/issue-7040-target"
        resetScroll
        data-testid="issue-7040-target-link"
        className="fixed right-4 bottom-4 z-50 rounded bg-blue-600 px-4 py-2 font-medium text-white shadow-lg"
      >
        Go to issue-7040-target
      </Link>

      <div className="mt-4 grid gap-3">
        {Array.from({ length: sectionCount }).map((_, index) => (
          <section
            key={`issue-7040-source-section-${index}`}
            className="min-h-24 rounded border p-3"
          >
            <h4 className="font-medium">Section {index + 1}</h4>
            <p>
              This section adds vertical space so the page can be scrolled far
              enough to reproduce issue #7040.
            </p>
          </section>
        ))}
      </div>

      <div data-testid="issue-7040-source-bottom" className="py-8">
        Bottom of issue-7040-source
      </div>
    </div>
  )
}
