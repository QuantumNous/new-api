import { Hydrate } from '@tanstack/react-start'
import { idle, interaction, visible } from '@tanstack/react-start/hydration'

const unused = 'remove me from virtual modules'

function Outer() {
  return <section>Outer</section>
}

function NestedButton() {
  return <button>Nested</button>
}

function Sibling() {
  return <aside>Sibling</aside>
}

export function Page() {
  return (
    <>
      <Hydrate when={visible()}>
        <Outer />
        <Hydrate when={interaction()}>
          <NestedButton />
        </Hydrate>
      </Hydrate>
      <Hydrate when={idle()}>
        <Sibling />
      </Hydrate>
    </>
  )
}
