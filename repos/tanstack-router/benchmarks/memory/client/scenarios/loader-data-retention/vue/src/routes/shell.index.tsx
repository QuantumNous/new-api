import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/shell/')({
  component: ShellIndexComponent,
})

function ShellIndexComponent() {
  return <main data-bench-page="shell">ready</main>
}
