import { Outlet, createFileRoute } from '@tanstack/react-router'
import styles from '~/styles/dashboard-layout.module.css'

export const Route = createFileRoute('/app/dashboard')({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <div className={styles.dashboard} data-testid="dashboard-layout">
      <p className={styles.kicker}>Dashboard route layout CSS</p>
      <Outlet />
    </div>
  )
}
