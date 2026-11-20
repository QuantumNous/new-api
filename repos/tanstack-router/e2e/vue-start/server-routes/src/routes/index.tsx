import { Link, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div class="p-8">
      <h1 class="font-bold text-lg">Server routes E2E tests</h1>
      <ul class="list-disc p-4">
        <li>
          <Link to="/merge-middleware-context">
            server route middleware context is merged correctly
          </Link>
        </li>
        <li>
          <Link to="/methods">server route methods</Link>
        </li>
      </ul>
    </div>
  )
}
