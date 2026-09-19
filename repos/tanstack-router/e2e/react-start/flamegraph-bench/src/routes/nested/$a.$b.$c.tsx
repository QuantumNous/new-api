import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/nested/$a/$b/$c')({
  component: PageComponent,
})

function PageComponent() {
  const { c } = Route.useParams()

  return (
    <div>
      <p>{c}</p>
      <Outlet />
    </div>
  )
}
