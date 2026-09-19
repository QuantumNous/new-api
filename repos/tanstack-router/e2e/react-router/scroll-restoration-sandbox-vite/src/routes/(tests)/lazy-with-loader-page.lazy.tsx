import { createLazyFileRoute } from '@tanstack/react-router'
import { ScrollBlock } from '../-components/scroll-block'

export const Route = createLazyFileRoute('/(tests)/lazy-with-loader-page')({
  component: Component,
})

function Component() {
  return (
    <div className="p-2">
      <h3>lazy-with-loader-page</h3>
      <hr />
      <ScrollBlock />
    </div>
  )
}
