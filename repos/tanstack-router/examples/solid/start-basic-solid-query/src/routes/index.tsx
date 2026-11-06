import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div class="p-2">
      <h3>Welcome Home!!!</h3>
    </div>
  )
}
