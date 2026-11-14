/// <reference types="vite/client" />
import { createFileRoute } from '@tanstack/react-router'
import styles from '~/styles/card.module.css'

export const Route = createFileRoute('/modules')({
  component: Modules,
})

function Modules() {
  return (
    <div>
      <h1>CSS Collection Test - CSS Modules</h1>
      <p>
        This page tests that CSS modules are collected and served during SSR.
      </p>

      <div className={styles.card} data-testid="module-card">
        <div className={styles.title} data-testid="module-title">
          CSS Module Applied
        </div>
        <div className={styles.content} data-testid="module-content">
          This card should have a green theme with scoped class names even with
          JavaScript disabled.
        </div>
      </div>
    </div>
  )
}
