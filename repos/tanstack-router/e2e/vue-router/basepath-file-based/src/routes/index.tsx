import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  const navigate = Route.useNavigate()

  return (
    <div data-testid="home-component">
      <button
        data-testid="to-about-btn"
        onClick={() =>
          navigate({
            to: '/about',
            reloadDocument: true,
          })
        }
      >
        Navigate to /about with document reload
      </button>
    </div>
  )
}
