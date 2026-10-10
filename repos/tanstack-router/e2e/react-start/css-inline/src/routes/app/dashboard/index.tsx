import { createFileRoute } from '@tanstack/react-router'
import { NestedPanel } from '~/components/NestedPanel'
import styles from '~/styles/dashboard-index.module.css'

export const Route = createFileRoute('/app/dashboard/')({
  component: DashboardIndex,
})

function DashboardIndex() {
  return (
    <article className={styles.card} data-testid="dashboard-card">
      <h2 className={styles.title}>Inline dashboard</h2>
      <NestedPanel label="shared nested panel" />
    </article>
  )
}
