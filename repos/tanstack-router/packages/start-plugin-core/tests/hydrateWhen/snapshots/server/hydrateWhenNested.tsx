import { Hydrate } from '@tanstack/react-start';
import { idle, interaction, visible } from '@tanstack/react-start/hydration';
const unused = 'remove me from virtual modules';
function Outer() {
  return <section>Outer</section>;
}
function NestedButton() {
  return <button>Nested</button>;
}
function Sibling() {
  return <aside>Sibling</aside>;
}
export function Page() {
  return <>
      <Hydrate when={visible()} h="0_466696e41d">
        <Outer />
        <Hydrate when={interaction()} h="1_466696e41d">
          <NestedButton />
        </Hydrate>
      </Hydrate>
      <Hydrate when={idle()} h="2_466696e41d">
        <Sibling />
      </Hydrate>
    </>;
}