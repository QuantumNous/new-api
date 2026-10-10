import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
} from '@tanstack/vue-router'
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
  const loaderData = Route.useLoaderData()
  const pathname = useLocation({ select: (s) => s.pathname })
  return (
    <div class="grid lg:grid-cols-5 lg:divide-x min-h-dvh">
      <aside>
        <div class="p-4">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            class="aria-[current='page']:underline"
          >
            Home
          </Link>
        </div>
        <div class="p-4">
          <p class="mb-1 border-b">Libraries</p>
          <ul>
            {loaderData.value.libraries.map((library) => (
              <li key={library}>
                <Link
                  to="/$project"
                  params={{ project: library }}
                  class="aria-[current='page']:underline"
                >
                  {library}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main class="lg:col-span-4 p-4">
        <p
          class="text-sm lg:text-base pb-4 border-b break-all"
          data-testid="selected-route-label"
        >
          {pathname.value}
        </p>
        <Outlet />
      </main>
    </div>
  )
}
