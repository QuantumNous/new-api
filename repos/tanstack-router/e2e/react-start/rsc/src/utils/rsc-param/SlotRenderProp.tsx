'use client'

import * as React from 'react'
import { clientStyles } from '../styles'

export function SlotRenderProp() {
  const instanceId = React.useRef(Math.random().toString(16).slice(2))
  const [checked, setChecked] = React.useState(false)

  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.log(`[mount] SlotRenderProp ${instanceId.current}`)
    return () => {
      // eslint-disable-next-line no-console
      console.log(`[unmount] SlotRenderProp ${instanceId.current}`)
    }
  }, [])

  return (
    <div
      style={clientStyles.container}
      data-testid="rsc-param-slot-render-prop"
    >
      <div style={clientStyles.header}>
        <span style={clientStyles.badge}>CLIENT SLOT FOOTER</span>
      </div>

      <div style={{ fontSize: '12px', marginBottom: '8px' }}>
        instance:{' '}
        <span data-testid="rsc-param-slot-render-prop-instance">
          {instanceId.current}
        </span>
      </div>

      <label style={{ fontSize: '12px', display: 'inline-flex', gap: '8px' }}>
        <input
          data-testid="rsc-param-slot-render-prop-toggle"
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        toggled:{' '}
        <span data-testid="rsc-param-slot-render-prop-value">
          {checked ? 'true' : 'false'}
        </span>
      </label>
    </div>
  )
}
