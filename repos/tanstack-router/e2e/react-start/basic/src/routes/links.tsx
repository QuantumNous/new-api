import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/links')({
  component: () => {
    const navigate = Route.useNavigate()
    return (
      <div>
        <h1 className="mb-4 text-4xl font-extrabold lmd:text-5xl lg:text-6xl ">
          link test
        </h1>
        <div className="mb-2">
          <Link
            to="/posts"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Link to /posts
          </Link>
        </div>
        <div className="mb-2">
          <Link
            to="/posts"
            reloadDocument={true}
            activeProps={{
              className: 'font-bold',
            }}
          >
            Link to /posts (reloadDocument=true)
          </Link>
        </div>
        <div className="mb-2">
          <button onClick={() => navigate({ to: '/posts' })}>
            navigate to /posts
          </button>
        </div>
        <div className="mb-2">
          <button
            onClick={() => navigate({ to: '/posts', reloadDocument: true })}
          >
            navigate to /posts (reloadDocument=true)
          </button>
        </div>
      </div>
    )
  },
})
