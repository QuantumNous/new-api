import { createFileRoute, useNavigate } from '@tanstack/react-router'

export const Route = createFileRoute('/relative/useNavigate/path/$path/')({
  component: RouteComponent,
  loader: ({ params }) => {
    return params
  },
})

function RouteComponent() {
  const navigate = useNavigate()

  const { path } = Route.useParams()

  return (
    <div className="p-2">
      <div
        className="border-b"
        data-testid="relative-useNavigate-path-param-header"
      >
        Hello from "/relative/useNavigate/path/{path}"!
      </div>
      <div>
        <button
          onClick={() =>
            navigate({
              from: '/relative/useNavigate/path/',
              to: './$path',
              params: { path: path === 'a' ? 'b' : 'a' },
            })
          }
          className="mr-2"
          data-testid="relative-useNavigate-path-param-switchAB"
        >
          To {path === 'a' ? 'b' : 'a'}
        </button>
      </div>
    </div>
  )
}
