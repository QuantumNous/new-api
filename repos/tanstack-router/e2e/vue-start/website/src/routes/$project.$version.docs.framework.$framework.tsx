import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
} from '@tanstack/vue-router'
import { getDocumentHeads } from '~/server/document'
import { getProject } from '~/server/projects'

export const Route = createFileRoute(
  '/$project/$version/docs/framework/$framework',
)({
  loader: async ({ params: { project } }) => {
    const library = await getProject({ data: project })
    const documents = await getDocumentHeads()
    return {
      library,
      documents,
    }
  },
  component: Page,
})

function Page() {
  const project = Route.useLoaderData({ select: (s) => s.library })
  const documents = Route.useLoaderData({ select: (s) => s.documents })
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
          <p class="mb-1 border-b">Version</p>
          <ul>
            {project.value.versions.map((version) => (
              <li key={version}>
                <Link
                  from="/$project/$version/docs/framework/$framework"
                  to="/$project/$version/docs/framework/$framework/$"
                  params={{ version }}
                  class="aria-[current='page']:underline"
                  activeOptions={{ exact: false }}
                >
                  {version}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div class="p-4">
          <p class="mb-1 border-b">Framework</p>
          <ul>
            {project.value.frameworks.map((framework) => (
              <li key={framework}>
                <Link
                  from="/$project/$version/docs/framework/$framework"
                  to="/$project/$version/docs/framework/$framework/$"
                  params={{ framework }}
                  class="aria-[current='page']:underline"
                  activeOptions={{ exact: false }}
                >
                  {framework}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div class="p-4">
          <p class="mb-1 border-b">Content</p>
          <ul>
            {documents.value.map((doc) => (
              <li key={doc.id}>
                <Link
                  from="/$project/$version/docs/framework/$framework"
                  to="/$project/$version/docs/framework/$framework/$"
                  params={{ _splat: doc.id }}
                  class="aria-[current='page']:underline"
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div class="p-4">
          <p class="mb-1 border-b">Examples</p>
          <ul>
            {project.value.examples.map((example) => (
              <li key={example}>
                <Link
                  from="/$project/$version/docs/framework/$framework"
                  to="/$project/$version/docs/framework/$framework/examples/$"
                  params={{ _splat: example }}
                  class="aria-[current='page']:underline"
                >
                  {example}
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
