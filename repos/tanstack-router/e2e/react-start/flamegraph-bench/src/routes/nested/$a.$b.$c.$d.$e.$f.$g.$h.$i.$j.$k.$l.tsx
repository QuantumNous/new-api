import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k/$l',
)({
  component: PageComponent,
})

function PageComponent() {
  const { l } = Route.useParams()

  return (
    <div>
      <p>{l}</p>
      <Outlet />
    </div>
  )
}
