import {
  Link,
  Outlet,
  useLocation,
  createFileRoute,
} from '@tanstack/react-router'
import { getProjects } from '~/server/projects'

export const Route = createFileRoute('/_library')({
  loader: async () => {
    const projects = await getProjects()
    return {
      libraries: projects,
    }
  },
  component: Layout,
})

function Layout() {
  const { libraries } = Route.useLoaderData()
  const pathname = useLocation({ select: (s) => s.pathname })
  return (
    <div className="grid lg:grid-cols-5 lg:divide-x min-h-dvh">
      <aside>
        <div className="p-4">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="aria-[current='page']:underline"
          >
            Home
          </Link>
        </div>
        <div className="p-4">
          <p className="mb-1 border-b">Libraries</p>
          <ul>
            {libraries.map((library) => (
              <li key={library}>
                <Link
                  to="/$project"
                  params={{ project: library }}
                  className="aria-[current='page']:underline"
                >
                  {library}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="lg:col-span-4 p-4">
        <p
          className="text-sm lg:text-base pb-4 border-b break-all"
          data-testid="selected-route-label"
        >
          {pathname}
        </p>
        <Outlet />
      </main>
    </div>
  )
}
