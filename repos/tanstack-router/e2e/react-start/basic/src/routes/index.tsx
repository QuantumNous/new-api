import { createFileRoute } from '@tanstack/react-router'
import { CustomMessage } from '~/components/CustomMessage'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="p-2">
      <h3>Welcome Home!!!</h3>
      <CustomMessage message="Hello from a custom component!" />
    </div>
  )
}
