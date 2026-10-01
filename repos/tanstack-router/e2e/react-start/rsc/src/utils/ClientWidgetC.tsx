'use client'

import * as React from 'react'
import './ClientWidgetC.css'

/**
 * Client widget C - loaded in server component B but NOT rendered.
 * Uses GLOBAL CSS that targets [data-testid="serverb-note"].
 * If this CSS is loaded when ServerB is not rendered, the note will turn orange.
 */
export function ClientWidgetC({ title }: { title: string }) {
  const [value, setValue] = React.useState(50)

  return (
    <div className="client-widget-c" data-testid="client-widget-c">
      <h3 data-testid="client-widget-c-title">{title}</h3>
      <p>This widget is loaded but NOT rendered.</p>
      <input
        type="range"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        data-testid="client-widget-c-slider"
      />
      <span data-testid="client-widget-c-value">{value}%</span>
    </div>
  )
}
