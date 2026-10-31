import { createFileRoute } from '@tanstack/solid-router'
import { Hydrate } from '@tanstack/solid-start'
import { visible } from '@tanstack/solid-start/hydration'

export const Route = createFileRoute('/')({
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <Hydrate when={visible()}>
      <div>hello world</div>
    </Hydrate>
  )
}
