import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div data-testid="home">
      <h1>Early Hints E2E Test</h1>
      <p>This app tests HTTP 103 Early Hints functionality.</p>
    </div>
  )
}
