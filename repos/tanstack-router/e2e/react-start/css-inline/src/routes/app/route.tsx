import { Outlet, createFileRoute } from '@tanstack/react-router'
import styles from '~/styles/app-layout.module.css'

export const Route = createFileRoute('/app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <section className={styles.layout} data-testid="app-layout">
      <h1 className={styles.heading}>Nested app shell</h1>
      <Outlet />
    </section>
  )
}
