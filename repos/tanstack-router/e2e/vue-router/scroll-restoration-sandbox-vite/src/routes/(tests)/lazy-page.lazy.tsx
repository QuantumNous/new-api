import { createLazyFileRoute } from '@tanstack/vue-router'
import { ScrollBlock } from '../-components/scroll-block'

export const Route = createLazyFileRoute('/(tests)/lazy-page')({
  component: Component,
})

function Component() {
  return (
    <div class="p-2">
      <h3>lazy-page</h3>
      <hr />
      <ScrollBlock />
    </div>
  )
}
