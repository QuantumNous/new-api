import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k',
)({
  component: PageComponent,
})

function PageComponent() {
  const { k } = Route.useParams()

  return (
    <div>
      <p>{k}</p>
      <Outlet />
    </div>
  )
}
