import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j')({
  component: PageComponent,
})

function PageComponent() {
  const { j } = Route.useParams()

  return (
    <div>
      <p>{j}</p>
      <Outlet />
    </div>
  )
}
