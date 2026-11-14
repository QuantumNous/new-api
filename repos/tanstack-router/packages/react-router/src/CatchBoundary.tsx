'use client'

import * as React from 'react'
import type { ErrorRouteComponent } from './route'
import type { ErrorInfo } from 'react'

export function CatchBoundary(props: {
  getResetKey: () => number | string
  children: React.ReactNode
  errorComponent?: ErrorRouteComponent
  onCatch?: (error: Error, errorInfo: ErrorInfo) => void
}) {
  const errorComponent = props.errorComponent ?? ErrorComponent

  return (
    <CatchBoundaryImpl
      getResetKey={props.getResetKey}
      onCatch={props.onCatch}
      children={({ error, reset }) => {
        if (error) {
          return React.createElement(errorComponent, {
            error,
            reset,
          })
        }

        return props.children
      }}
    />
  )
}

class CatchBoundaryImpl extends React.Component<{
  getResetKey: () => number | string
  children: (props: {
    error: Error | null
    reset: () => void
  }) => React.ReactNode
  onCatch?: (error: Error, errorInfo: ErrorInfo) => void
}> {
  state = { error: null } as { error: Error | null; resetKey?: string | number }

  static getDerivedStateFromProps(
    props: { getResetKey: () => string | number },
    state: { resetKey?: string | number; error: Error | null },
  ) {
    const resetKey = props.getResetKey()

    if (state.error && state.resetKey !== resetKey) {
      return { resetKey, error: null }
    }

    return { resetKey }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  reset() {
    this.setState({ error: null })
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.onCatch) {
      this.props.onCatch(error, errorInfo)
    }
  }
  render() {
    return this.props.children({
      error: this.state.error,
      reset: () => {
        this.reset()
      },
    })
  }
}

export function ErrorComponent({ error }: { error: any }) {
  const [show, setShow] = React.useState(process.env.NODE_ENV !== 'production')

  return (
    <div style={{ padding: '.5rem', maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
        <strong style={{ fontSize: '1rem' }}>Something went wrong!</strong>
        <button
          style={{
            appearance: 'none',
            fontSize: '.6em',
            border: '1px solid currentColor',
            padding: '.1rem .2rem',
            fontWeight: 'bold',
            borderRadius: '.25rem',
          }}
          onClick={() => setShow((d) => !d)}
        >
          {show ? 'Hide Error' : 'Show Error'}
        </button>
      </div>
      <div style={{ height: '.25rem' }} />
      {show ? (
        <div>
          <pre
            style={{
              fontSize: '.7em',
              border: '1px solid red',
              borderRadius: '.25rem',
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
