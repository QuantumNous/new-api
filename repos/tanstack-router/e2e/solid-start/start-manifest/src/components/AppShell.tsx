/// <reference types="vite/client" />
import { ClientOnly, Link, Outlet, linkOptions } from '@tanstack/solid-router'
import styles from '~/styles/root-shell.module.css'

const ROUTES = linkOptions([
  { to: '/', label: 'home' },
  { to: '/a', label: '/a' },
  { to: '/b', label: '/b' },
  { to: '/lazy-css-static', label: '/lazy-css-static' },
  { to: '/lazy-css-lazy', label: '/lazy-css-lazy' },
  { to: '/r1', label: '/r1' },
  { to: '/r2', label: '/r2' },
  { to: '/shared-a', label: '/shared-a' },
])

export function AppShell() {
  return (
    <div class={styles.shell}>
      <nav class={styles.nav}>
        {ROUTES.map((route) => (
          <Link {...route} data-testid={`nav-${route.label}`}>
            {route.label}
          </Link>
        ))}
      </nav>

      <main class={styles.content}>
        <div class={styles.rootBadge} data-testid="root-shell-marker">
          Start manifest CSS root shell
        </div>
        <ClientOnly>
          <div data-testid="hydration-marker">hydrated</div>
        </ClientOnly>
        <Outlet />
      </main>
    </div>
  )
}
