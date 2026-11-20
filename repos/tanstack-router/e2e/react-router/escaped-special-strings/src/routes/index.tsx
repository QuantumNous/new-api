import { createFileRoute } from '@tanstack/react-router'

// This is the standard index route for the root path /
// It coexists with [index].tsx which creates a literal /index route
export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div>
      <h2 data-testid="page-title">Home Page</h2>
      <p data-testid="page-path">/</p>
      <p data-testid="page-description">
        This is the home/index route at /. It coexists with the escaped [index]
        route at /index.
      </p>
    </div>
  )
}
