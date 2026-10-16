import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/navigate-test')({
  component: NavigateTest,
})

function NavigateTest() {
  const navigate = Route.useNavigate()

  return (
    <div class="p-2">
      <h3 data-testid="navigate-test-component">Navigate Test</h3>
      <button
        data-testid="to-posts-href-with-basepath-btn"
        onClick={() =>
          navigate({
            href: '/custom/basepath/posts',
          })
        }
      >
        Navigate to /posts using href with basepath
      </button>{' '}
      <button
        data-testid="to-posts-href-with-basepath-reload-btn"
        onClick={() =>
          navigate({
            href: '/custom/basepath/posts',
            reloadDocument: true,
          })
        }
      >
        Navigate to /posts using href with basepath (reloadDocument)
      </button>
    </div>
  )
}
