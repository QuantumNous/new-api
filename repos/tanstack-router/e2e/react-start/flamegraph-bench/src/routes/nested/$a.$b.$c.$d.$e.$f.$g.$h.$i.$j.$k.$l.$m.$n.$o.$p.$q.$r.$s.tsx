import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k/$l/$m/$n/$o/$p/$q/$r/$s',
)({
  component: PageComponent,
})

function PageComponent() {
  const { s } = Route.useParams()

  return (
    <div>
      <p>{s}</p>
      <Outlet />
    </div>
  )
}
