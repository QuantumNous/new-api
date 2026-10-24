import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k/$l/$m/$n/$o/$p/$q/$r/$s/$t/$u/$v',
)({
  component: PageComponent,
})

function PageComponent() {
  const { v } = Route.useParams()

  return (
    <div>
      <p>{v}</p>
      <Outlet />
    </div>
  )
}
