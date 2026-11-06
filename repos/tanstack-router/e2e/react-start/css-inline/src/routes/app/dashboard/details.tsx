import { createFileRoute } from '@tanstack/react-router'
import { NestedPanel } from '~/components/NestedPanel'
import styles from '~/styles/dashboard-details.module.css'

export const Route = createFileRoute('/app/dashboard/details')({
  component: DashboardDetails,
})

function DashboardDetails() {
  return (
    <article className={styles.details} data-testid="details-card">
      <h2>Details route</h2>
      <NestedPanel label="details shared panel" />
    </article>
  )
}
