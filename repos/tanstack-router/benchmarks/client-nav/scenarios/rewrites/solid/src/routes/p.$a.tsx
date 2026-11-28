import { Outlet, createFileRoute } from '@tanstack/solid-router'
import { sectionLabel } from '../../../shared'

export const Route = createFileRoute('/p/$a')({
  component: SectionPage,
})

function SectionPage() {
  const params = Route.useParams()

  return (
    <section>
      <h1>{sectionLabel(params().a)}</h1>
      <Outlet />
    </section>
  )
}
