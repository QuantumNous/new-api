import { Link, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/relative/link/path/$path/')({
  component: RouteComponent,
  loader: ({ params }) => {
    return params
  },
})

function RouteComponent() {
  const params = Route.useParams()

  return (
    <div class="p-2">
      <div class="border-b" data-testid="relative-link-path-param-header">
        Hello from "/relative/links/path/{params().path}"!
      </div>
      <div>
        <Link
          from="/relative/link/path/"
          to="./$path"
          params={{ path: params().path === 'a' ? 'b' : 'a' }}
          class="mr-2"
          data-testid="relative-link-path-param-switchAB"
        >
          To {params().path === 'a' ? 'b' : 'a'}
        </Link>
      </div>
    </div>
  )
}
