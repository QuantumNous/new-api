import * as Solid from 'solid-js'
import { Dynamic } from 'solid-js/web'
import type { ErrorRouteComponent } from './route'

export function CatchBoundary(
  props: {
    getResetKey: () => number | string
    children: Solid.JSX.Element
    errorComponent?: ErrorRouteComponent
    onCatch?: (error: Error) => void
  } & Solid.ParentProps,
) {
  return (
    <Solid.ErrorBoundary
      fallback={(error, reset) => {
        props.onCatch?.(error)

        Solid.createEffect(
          Solid.on([props.getResetKey], () => reset(), { defer: true }),
        )

        return (
          <Dynamic
            component={props.errorComponent ?? ErrorComponent}
            error={error}
            reset={reset}
          />
        )
      }}
    >
      {props.children}
    </Solid.ErrorBoundary>
  )
}

export function ErrorComponent({ error }: { error: any }) {
  const [show, setShow] = Solid.createSignal(
    process.env.NODE_ENV !== 'production',
  )

  return (
    <div style={{ padding: '.5rem', 'max-width': '100%' }}>
      <div style={{ display: 'flex', 'align-items': 'center', gap: '.5rem' }}>
        <strong style={{ 'font-size': '1rem' }}>Something went wrong!</strong>
        <button
          style={{
            appearance: 'none',
            'font-size': '.6em',
            border: '1px solid currentColor',
            padding: '.1rem .2rem',
            'font-weight': 'bold',
            'border-radius': '.25rem',
          }}
          onClick={() => setShow((d) => !d)}
        >
          {show() ? 'Hide Error' : 'Show Error'}
        </button>
      </div>
      <div style={{ height: '.25rem' }} />
      {show() ? (
        <div>
          <pre
            style={{
              'font-size': '.7em',
              border: '1px solid red',
              'border-radius': '.25rem',
              padding: '.3rem',
              color: 'red',
              overflow: 'auto',
            }}
          >
            {error.message ? <code>{error.message}</code> : null}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
