import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k/$l/$m/$n/$o/$p/$q/$r/$s/$t/$u',
)({
  component: PageComponent,
})

function PageComponent() {
  const { u } = Route.useParams()

  return (
    <div>
      <p>{u}</p>
      <Outlet />
    </div>
  )
}
