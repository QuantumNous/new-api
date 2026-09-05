/// <reference types="vite/client" />
import { createFileRoute } from '@tanstack/vue-router'
import { SharedCard } from '~/components/SharedCard'
import styles from '~/styles/page-a.module.css'

export const Route = createFileRoute('/a')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <section class={styles.page} data-testid="page-a">
      <h1 class={styles.title}>Route /a</h1>
      <p>Route /a keeps the shared card styled.</p>
      <SharedCard label="from /a" />
    </section>
  )
}
