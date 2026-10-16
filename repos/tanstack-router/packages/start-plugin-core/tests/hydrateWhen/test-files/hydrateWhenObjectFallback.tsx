import { Hydrate } from '@tanstack/react-start'
import { idle, visible } from '@tanstack/react-start/hydration'

const spreadProps = {
  when: visible(),
  fallback: <div data-testid="bound-spread-fallback">Bound</div>,
}

function Widget(props: { title: string }) {
  return <p>{props.title}</p>
}

export function Page() {
  return (
    <>
      <Hydrate
        when={visible()}
        fallback={<div data-testid="direct-fallback">Direct</div>}
      >
        <Widget title="direct" />
      </Hydrate>
      <Hydrate
        {...{
          when: idle(),
          fallback: <div data-testid="inline-spread-fallback">Inline</div>,
        }}
      >
        <Widget title="inline spread" />
      </Hydrate>
      <Hydrate {...spreadProps}>
        <Widget title="bound spread" />
      </Hydrate>
    </>
  )
}
