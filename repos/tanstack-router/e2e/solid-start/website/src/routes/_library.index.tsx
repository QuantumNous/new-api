import { createFileRoute } from '@tanstack/solid-router'
export const Route = createFileRoute('/_library/')({
  component: Home,
})

function Home() {
  return (
    <div class="p-2">
      <h3 class="text-2xl mb-2">Website Landing Page</h3>
    </div>
  )
}
