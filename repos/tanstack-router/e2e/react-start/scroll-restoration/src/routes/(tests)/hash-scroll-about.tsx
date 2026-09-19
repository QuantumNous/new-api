import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { sleep } from '~/utils/posts'

export const Route = createFileRoute('/(tests)/hash-scroll-about')({
  loader: async () => {
    await sleep(50)
    return null
  },
  component: Component,
})

function Component() {
  return (
    <div className="p-2 grid gap-2">
      <h3>hash-scroll-about</h3>
      <p data-testid="hash-scroll-about-top">
        This route exists so hover preloading can reproduce the hash scroll bug.
      </p>
      <Link
        to="/hash-scroll-repro"
        hash="one"
        data-testid="hash-scroll-restore-link"
      >
        Return to #one
      </Link>
      <Link
        to="/hash-scroll-repro"
        search={{ scrollKey: 'destination' }}
        data-testid="hash-scroll-destination-link"
      >
        Return to the destination key
      </Link>
    </div>
  )
}
