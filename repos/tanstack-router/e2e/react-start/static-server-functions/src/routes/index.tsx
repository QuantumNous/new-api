import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { staticFunctionMiddleware } from '@tanstack/start-static-server-functions'

const fetchIndexData = createServerFn({ method: 'GET' })
  .middleware([staticFunctionMiddleware])
  .handler(async () => {
    return { message: 'Hello from static server function!' }
  })

export const Route = createFileRoute('/')({
  loader: async () => fetchIndexData(),
  component: Home,
})

function Home() {
  const data = Route.useLoaderData()
  return (
    <div>
      <h1 data-testid="index-heading">Home</h1>
      <p data-testid="index-message">{data.message}</p>
      <Link to="/posts" data-testid="link-to-posts">
        Go to Posts
      </Link>
    </div>
  )
}
