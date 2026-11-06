'use client'

import * as React from 'react'
import { clientStyles } from '../styles'

export function ClientRenderedDirect() {
  const instanceId = React.useRef(Math.random().toString(16).slice(2))
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(`[mount] ClientRenderedDirect ${instanceId.current}`)
    return () => {
      // eslint-disable-next-line no-console
      console.log(`[unmount] ClientRenderedDirect ${instanceId.current}`)
    }
  }, [])

  return (
    <div style={clientStyles.container} data-testid="rsc-param-direct">
      <div style={clientStyles.header}>
        <span style={clientStyles.badge}>CLIENT DIRECT</span>
      </div>

      <div style={{ fontSize: '12px', marginBottom: '8px' }}>
        instance:{' '}
        <span data-testid="rsc-param-direct-instance">
          {instanceId.current}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          data-testid="rsc-param-direct-inc"
          onClick={() => setCount((c) => c + 1)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #86efac',
            backgroundColor: '#22c55e',
            color: 'white',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          +
        </button>

        <div style={{ fontSize: '12px' }}>
          count: <span data-testid="rsc-param-direct-count">{count}</span>
        </div>
      </div>
    </div>
  )
}
