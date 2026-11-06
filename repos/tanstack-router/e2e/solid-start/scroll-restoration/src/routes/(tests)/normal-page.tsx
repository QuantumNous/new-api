import { createFileRoute } from '@tanstack/solid-router'
import * as Solid from 'solid-js'

import { ScrollBlock } from '../-components/scroll-block'

export const Route = createFileRoute('/(tests)/normal-page')({
  component: Component,
})

function Component() {
  return (
    <div class="p-2">
      <h3>normal-page</h3>
      <hr />
      <ScrollBlock />
    </div>
  )
}
