import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/relative/link/path/$path/')({
  component: RouteComponent,
  loader: ({ params }) => {
    return params
  },
})

function RouteComponent() {
  const { path } = Route.useParams()

  return (
    <div className="p-2">
      <div className="border-b" data-testid="relative-link-path-param-header">
        Hello from "/relative/links/path/{path}"!
      </div>
      <div>
        <Link
          from="/relative/link/path/"
          to="./$path"
          params={{ path: path === 'a' ? 'b' : 'a' }}
          className="mr-2"
          data-testid="relative-link-path-param-switchAB"
        >
          To {path === 'a' ? 'b' : 'a'}
        </Link>
      </div>
    </div>
  )
}
