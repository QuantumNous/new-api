import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
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
    </div>
  )
}
