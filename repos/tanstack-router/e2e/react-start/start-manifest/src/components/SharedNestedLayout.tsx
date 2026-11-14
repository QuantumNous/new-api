import { Link, linkOptions } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import styles from '~/styles/shared-layout.module.css'

const SHARED_ROUTES = linkOptions([
  { to: '/shared-a', label: '/shared-a' },
  { to: '/shared-b', label: '/shared-b' },
  { to: '/shared-c', label: '/shared-c' },
])

export function SharedNestedLayout({ children }: { children: ReactNode }) {
  return (
    <section className={styles.layout} data-testid="shared-layout-shell">
      <div className={styles.heading} data-testid="shared-layout-heading">
        Shared nested layout CSS module
      </div>
      <nav>
        {SHARED_ROUTES.map((route) => (
          <Link key={route.to} {...route} data-testid={`nav-${route.label}`}>
            {route.label}
          </Link>
        ))}
      </nav>
      <div className={styles.body} data-testid="shared-layout-copy">
        {children}
      </div>
    </section>
  )
}
