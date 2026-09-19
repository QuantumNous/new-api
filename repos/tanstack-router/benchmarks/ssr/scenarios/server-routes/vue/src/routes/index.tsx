import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return <main>server routes</main>
}
