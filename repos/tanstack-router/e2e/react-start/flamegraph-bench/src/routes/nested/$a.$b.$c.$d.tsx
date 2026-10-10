import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/nested/$a/$b/$c/$d')({
  component: PageComponent,
})

function PageComponent() {
  const { d } = Route.useParams()

  return (
    <div>
      <p>{d}</p>
      <Outlet />
    </div>
  )
}
