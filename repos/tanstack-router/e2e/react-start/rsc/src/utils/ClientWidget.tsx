'use client'

import * as React from 'react'
import styles from './ClientWidget.module.css'

/**
 * Client widget component with CSS modules.
 * This is a "use client" component that should have its JS and CSS preloaded
 * when used inside a server component.
 */
export function ClientWidget({ title }: { title: string }) {
  const [count, setCount] = React.useState(0)

  return (
    <div className={styles.widget} data-testid="client-widget">
      <div className={styles.header}>
        <span className={styles.badge} data-testid="client-widget-badge">
          CLIENT COMPONENT
        </span>
      </div>
      <h3 className={styles.title} data-testid="client-widget-title">
        {title}
      </h3>
      <p className={styles.content} data-testid="client-widget-content">
        This is a client component with CSS modules. The CSS should be preloaded
        in the document head to prevent flash of unstyled content.
      </p>
      <div className={styles.counter}>
        <button
          className={styles.button}
          onClick={() => setCount((c) => c - 1)}
          data-testid="client-widget-decrement"
        >
          -
        </button>
        <span className={styles.count} data-testid="client-widget-count">
          {count}
        </span>
        <button
          className={styles.button}
          onClick={() => setCount((c) => c + 1)}
          data-testid="client-widget-increment"
        >
          +
        </button>
      </div>
    </div>
  )
}
