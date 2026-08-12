import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k/$l/$m/$n/$o/$p',
)({
  component: PageComponent,
})

function PageComponent() {
  const { p } = Route.useParams()

  return (
    <div>
      <p>{p}</p>
      <Outlet />
    </div>
  )
}
