/// <reference types="vite/client" />
import { createFileRoute } from '@tanstack/vue-router'
import styles from '~/styles/route-two.module.css'

export const Route = createFileRoute('/r2')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <section>
      <h1>Route /r2</h1>
      <div class={styles.card} data-testid="route-r2-card">
        Route /r2 CSS module styling
      </div>
    </section>
  )
}
