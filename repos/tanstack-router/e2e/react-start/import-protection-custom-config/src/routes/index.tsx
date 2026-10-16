import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div>
      <h1 data-testid="heading">Import Protection Custom Config E2E</h1>
      <p data-testid="status">
        App loaded successfully with custom file patterns
      </p>
    </div>
  )
}
