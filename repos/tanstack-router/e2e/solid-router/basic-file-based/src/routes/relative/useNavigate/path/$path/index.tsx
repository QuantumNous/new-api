import { createFileRoute, useNavigate } from '@tanstack/solid-router'

export const Route = createFileRoute('/relative/useNavigate/path/$path/')({
  component: RouteComponent,
  loader: ({ params }) => {
    return params
  },
})

function RouteComponent() {
  const navigate = useNavigate()

  const params = Route.useParams()

  return (
    <div class="p-2">
      <div
        class="border-b"
        data-testid="relative-useNavigate-path-param-header"
      >
        Hello from "/relative/useNavigate/path/{params().path}"!
      </div>
      <div>
        <button
          onClick={() =>
            navigate({
              from: '/relative/useNavigate/path/',
              to: './$path',
              params: { path: params().path === 'a' ? 'b' : 'a' },
            })
          }
          class="mr-2"
          data-testid="relative-useNavigate-path-param-switchAB"
        >
          To {params().path === 'a' ? 'b' : 'a'}
        </button>
      </div>
    </div>
  )
}
