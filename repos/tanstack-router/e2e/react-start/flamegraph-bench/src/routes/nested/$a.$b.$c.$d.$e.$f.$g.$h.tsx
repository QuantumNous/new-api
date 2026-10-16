import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/nested/$a/$b/$c/$d/$e/$f/$g/$h')({
  component: PageComponent,
})

function PageComponent() {
  const { h } = Route.useParams()

  return (
    <div>
      <p>{h}</p>
      <Outlet />
    </div>
  )
}
