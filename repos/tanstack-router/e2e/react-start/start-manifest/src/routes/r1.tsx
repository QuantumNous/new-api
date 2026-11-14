import { createFileRoute } from '@tanstack/react-router'
import styles from '~/styles/route-one.module.css'

export const Route = createFileRoute('/r1')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <section>
      <h1>Route /r1</h1>
      <div className={styles.card} data-testid="route-r1-card">
        Route /r1 CSS module styling
      </div>
    </section>
  )
}
