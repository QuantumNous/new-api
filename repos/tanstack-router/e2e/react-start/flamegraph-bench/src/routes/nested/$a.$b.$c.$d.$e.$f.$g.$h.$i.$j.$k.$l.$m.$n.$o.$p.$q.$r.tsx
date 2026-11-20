import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k/$l/$m/$n/$o/$p/$q/$r',
)({
  component: PageComponent,
})

function PageComponent() {
  const { r } = Route.useParams()

  return (
    <div>
      <p>{r}</p>
      <Outlet />
    </div>
  )
}
