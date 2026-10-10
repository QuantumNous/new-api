import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/nested/$a/$b/$c/$d/$e/$f/$g')({
  component: PageComponent,
})

function PageComponent() {
  const { g } = Route.useParams()

  return (
    <div>
      <p>{g}</p>
      <Outlet />
    </div>
  )
}
