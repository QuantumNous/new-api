import { createFileRoute } from '@tanstack/solid-router'
import { CustomMessage } from '~/components/CustomMessage'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div class="p-2">
      <h3>Welcome Home!!!</h3>
      <CustomMessage message="Hello from a custom component!" />
    </div>
  )
}
