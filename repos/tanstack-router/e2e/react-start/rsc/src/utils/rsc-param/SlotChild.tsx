'use client'

import * as React from 'react'
import { clientStyles } from '../styles'

export function SlotChild() {
  const instanceId = React.useRef(Math.random().toString(16).slice(2))
  const [text, setText] = React.useState('hello')

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(`[mount] SlotChild ${instanceId.current}`)
    return () => {
      // eslint-disable-next-line no-console
      console.log(`[unmount] SlotChild ${instanceId.current}`)
    }
  }, [])

  return (
    <div style={clientStyles.container} data-testid="rsc-param-slot-child">
      <div style={clientStyles.header}>
        <span style={clientStyles.badge}>CLIENT SLOT CHILD</span>
      </div>

      <div style={{ fontSize: '12px', marginBottom: '8px' }}>
        instance:{' '}
        <span data-testid="rsc-param-slot-child-instance">
          {instanceId.current}
        </span>
      </div>

      <label style={{ fontSize: '12px', display: 'block' }}>
        value:{' '}
        <input
          data-testid="rsc-param-slot-child-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{
            borderRadius: '6px',
            border: '1px solid #86efac',
            padding: '6px 10px',
            marginLeft: '6px',
          }}
        />
      </label>

      <div style={{ fontSize: '12px', marginTop: '8px' }}>
        echo: <span data-testid="rsc-param-slot-child-value">{text}</span>
      </div>
    </div>
  )
}
