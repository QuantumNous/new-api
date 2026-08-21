'use client'

import { useHydrated } from '@tanstack/react-router'
import * as React from 'react'
import styles from './ClientWidgetB.module.css'

/**
 * Client widget B - passed via children slot to server component.
 * Uses CSS module B with teal theme.
 */
export function ClientWidgetB({ title }: { title: string }) {
  const [active, setActive] = React.useState(false)
  const isHydrated = useHydrated()

  return (
    <div className={styles.widget} data-testid="client-widget-b">
      <div className={styles.header}>
        <span className={styles.badge} data-testid="client-widget-b-badge">
          CLIENT B (Slot)
        </span>
      </div>
      <h3 className={styles.title} data-testid="client-widget-b-title">
        {title}
      </h3>
      <p className={styles.content}>Passed via children slot to RSC.</p>
      <button
        className={`${styles.toggleButton} ${active ? styles.active : ''}`}
        onClick={() => setActive((a) => !a)}
        data-testid="client-widget-b-toggle"
        disabled={!isHydrated}
      >
        {active ? 'Active' : 'Inactive'}
      </button>
    </div>
  )
}
