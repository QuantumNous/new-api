import { createFileRoute } from '@tanstack/react-router'

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
      </button>{' '}
      <button
        data-testid="to-redirect-btn"
        onClick={() =>
          navigate({
            to: '/redirect',
          })
        }
      >
        Navigate to /redirect
      </button>{' '}
      <button
        data-testid="to-redirect-reload-btn"
        onClick={() =>
          navigate({
            to: '/redirectReload',
          })
        }
      >
        Navigate to /redirectReload
      </button>{' '}
      <button
        data-testid="to-about-href-with-basepath-btn"
        onClick={() =>
          navigate({
            href: '/app/about',
          })
        }
      >
        Navigate to /about using href with basepath
      </button>{' '}
      <button
        data-testid="to-about-href-with-basepath-reload-btn"
        onClick={() =>
          navigate({
            href: '/app/about',
            reloadDocument: true,
          })
        }
      >
        Navigate to /about using href with basepath (reloadDocument)
      </button>
    </div>
  )
}
