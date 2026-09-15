import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k/$l/$m/$n/$o/$p/$q/$r/$s/$t/$u/$v/$w',
)({
  component: PageComponent,
})

function PageComponent() {
  const { w } = Route.useParams()

  return (
    <div>
      <p>{w}</p>
      <Outlet />
    </div>
  )
}
