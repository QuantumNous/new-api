import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="p-8">
      <h1 className="font-bold text-lg">Server Routes E2E tests</h1>
      <ul className="list-disc p-4">
        <li>
          <Route.Link to="./merge-middleware-context">
            server route middleware context is merged correctly
          </Route.Link>
        </li>
        <li>
          <Route.Link to="./methods">server route methods</Route.Link>
        </li>
      </ul>
    </div>
  )
}
