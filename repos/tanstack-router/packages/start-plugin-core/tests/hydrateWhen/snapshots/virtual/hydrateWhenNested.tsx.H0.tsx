import { Hydrate } from '@tanstack/react-start';
import { interaction } from '@tanstack/react-start/hydration';
function Outer() {
  return <section>Outer</section>;
}
function NestedButton() {
  return <button>Nested</button>;
}
export function H0() {
  return <>
        <Outer />
        <Hydrate when={interaction()}>
          <NestedButton />
        </Hydrate>
      </>;
}