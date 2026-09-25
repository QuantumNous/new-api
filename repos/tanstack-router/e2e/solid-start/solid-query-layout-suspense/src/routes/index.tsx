import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: () => <main>Home page</main>,
})
