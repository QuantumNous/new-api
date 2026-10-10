import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()

  return (
    <div data-testid="about-component">
      <button
        onClick={() => navigate({ to: '/', reloadDocument: true })}
        data-testid="to-home-btn"
      >
        Navigate to / with document reload
      </button>
    </div>
  )
}
