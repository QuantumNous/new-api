import { Link, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import styles from '~/styles/shell.module.css'

export function Shell() {
  useEffect(() => {
    ;(window as any).__CSS_INLINE_E2E_HYDRATED__ = true
  }, [])

  return (
    <main className={styles.shell} data-testid="shell">
      <nav className={styles.nav}>
        <Link data-testid="nav-home" to="/">
          Home
        </Link>
        <Link data-testid="nav-dashboard" to="/app/dashboard">
          Dashboard
        </Link>
        <Link data-testid="nav-details" to="/app/dashboard/details">
          Details
        </Link>
      </nav>
      <Outlet />
    </main>
  )
}
