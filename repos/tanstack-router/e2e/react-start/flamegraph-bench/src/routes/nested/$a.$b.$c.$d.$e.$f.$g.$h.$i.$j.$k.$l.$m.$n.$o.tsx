import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k/$l/$m/$n/$o',
)({
  component: PageComponent,
})

function PageComponent() {
  const { o } = Route.useParams()

  return (
    <div>
      <p>{o}</p>
      <Outlet />
    </div>
  )
}
