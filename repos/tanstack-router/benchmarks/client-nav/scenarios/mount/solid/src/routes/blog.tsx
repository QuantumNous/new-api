import { Outlet, createFileRoute } from '@tanstack/solid-router'
import { blogContext } from '../../../shared'

export const Route = createFileRoute('/blog')({
  beforeLoad: () => blogContext(),
  component: BlogLayout,
})

function BlogLayout() {
  return (
    <section>
      <h2>Blog</h2>
      <Outlet />
    </section>
  )
}
