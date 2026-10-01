import { Outlet, createFileRoute } from '@tanstack/solid-router'
import { docsLayoutHead } from '../../../shared'

export const Route = createFileRoute('/docs')({
  head: docsLayoutHead,
  component: DocsLayout,
})

function DocsLayout() {
  return (
    <section>
      <h2>Docs</h2>
      <Outlet />
    </section>
  )
}
