/// <reference types="vite/client" />
import { createFileRoute } from '@tanstack/solid-router'
import { SharedCard } from '~/components/SharedCard'
import styles from '~/styles/page-b.module.css'

export const Route = createFileRoute('/b')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <section class={styles.page} data-testid="page-b">
      <h1 class={styles.title}>Route /b</h1>
      <p>Route /b should keep the shared card stylesheet after nav.</p>
      <SharedCard label="from /b" />
    </section>
  )
}
