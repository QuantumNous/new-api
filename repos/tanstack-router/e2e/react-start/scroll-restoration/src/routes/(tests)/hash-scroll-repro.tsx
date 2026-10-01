import * as React from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { sleep } from '~/utils/posts'

export const Route = createFileRoute('/(tests)/hash-scroll-repro')({
  validateSearch: z.object({
    scrollKey: z.string().optional(),
    invalidateOnMount: z.boolean().optional(),
  }),
  loader: async () => {
    await sleep(50)
    return null
  },
  component: Component,
})

const sectionIds = ['one', 'two', 'three', 'four', 'five'] as const

function Component() {
  const router = useRouter()
  const { invalidateOnMount } = Route.useSearch()
  const [invalidateCount, setInvalidateCount] = React.useState(0)
  const invalidatedOnMount = React.useRef(false)

  React.useLayoutEffect(() => {
    if (!invalidateOnMount || invalidatedOnMount.current) {
      return
    }

    invalidatedOnMount.current = true
    void router.invalidate().then(() => {
      setInvalidateCount((count) => count + 1)
    })
  }, [invalidateOnMount, router])

  return (
    <div className="p-2">
      <div className="sticky top-0 z-40 grid gap-2 border-b bg-white/95 p-2 backdrop-blur dark:bg-black/95">
        <h3>hash-scroll-repro</h3>
        <p data-testid="hash-scroll-repro-invalidate-count">
          Invalidate count: {invalidateCount}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/hash-scroll-about"
            preload="intent"
            preloadDelay={0}
            className="rounded border px-3 py-2"
            data-testid="hash-scroll-about-link"
          >
            About
          </Link>
          <button
            type="button"
            className="rounded border px-3 py-2"
            data-testid="hash-scroll-invalidate-button"
            onClick={async () => {
              await router.invalidate()
              setInvalidateCount((count) => count + 1)
            }}
          >
            Invalidate
          </button>
          <Link
            to="/hash-scroll-repro"
            hash="one"
            className="rounded border px-3 py-2"
            data-testid="hash-scroll-section-one-link"
          >
            #one
          </Link>
          <Link
            to="/hash-scroll-repro"
            hash="four"
            className="rounded border px-3 py-2"
            data-testid="hash-scroll-section-four-no-reset-link"
            resetScroll={false}
          >
            #four no reset
          </Link>
          <Link
            to="/hash-scroll-repro"
            search={{ scrollKey: 'destination' }}
            hash="one"
            className="rounded border px-3 py-2"
            data-testid="hash-scroll-different-key-link"
          >
            #one different key
          </Link>
          <Link
            to="/hash-scroll-repro"
            search={{ invalidateOnMount: true }}
            hash="one"
            className="rounded border px-3 py-2"
            data-testid="hash-scroll-layout-invalidate-link"
          >
            #one and invalidate in layout effect
          </Link>
        </div>
      </div>

      <div
        data-scroll-restoration-id="hash-scroll-nested"
        data-testid="hash-scroll-nested"
        className="mt-4 h-24 overflow-auto rounded border p-2"
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i}>Nested scroll row {i}</div>
        ))}
      </div>

      <div
        id="hash-scroll-reset-target"
        data-testid="hash-scroll-reset-target"
        className="mt-4 h-24 overflow-auto rounded border p-2"
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i}>Hash reset target row {i}</div>
        ))}
      </div>

      <div className="mt-6 grid gap-10">
        {sectionIds.map((sectionId) => (
          <section
            key={sectionId}
            id={sectionId}
            data-testid={`hash-scroll-section-${sectionId}`}
            className="flex min-h-[70vh] items-center justify-center rounded border text-2xl font-medium"
          >
            {sectionId}
          </section>
        ))}
      </div>
    </div>
  )
}
