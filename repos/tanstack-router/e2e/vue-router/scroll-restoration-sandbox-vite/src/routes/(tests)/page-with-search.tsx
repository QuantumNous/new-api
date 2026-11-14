import { createFileRoute } from '@tanstack/vue-router'
import { z } from 'zod'
import { ScrollBlock } from '../-components/scroll-block'

export const Route = createFileRoute('/(tests)/page-with-search')({
  validateSearch: z.object({ where: z.string() }),
  component: Component,
})

function Component() {
  return (
    <div class="p-2">
      <h3>page-with-search</h3>
      <hr />
      <ScrollBlock />
    </div>
  )
}
