/// <reference types="vite/client" />
import { Link, linkOptions } from '@tanstack/solid-router'
import styles from '~/styles/shared-layout.module.css'

const ROUTES = linkOptions([
  { to: '/shared-a', label: '/shared-a' },
  { to: '/shared-b', label: '/shared-b' },
  { to: '/shared-c', label: '/shared-c' },
])

export function SharedNestedLayout(props: { children?: any }) {
  return (
    <section class={styles.layout} data-testid="shared-layout-shell">
      <div class={styles.heading} data-testid="shared-layout-heading">
        Shared nested layout CSS
      </div>

      <nav class={styles.nav}>
        {ROUTES.map((route) => (
          <Link {...route} data-testid={`nav-${route.label}`}>
            {route.label}
          </Link>
        ))}
      </nav>

      <div class={styles.body} data-testid="shared-layout-copy">
        {props.children}
      </div>
    </section>
  )
}
