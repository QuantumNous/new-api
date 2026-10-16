import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k/$l/$m/$n/$o/$p/$q',
)({
  component: PageComponent,
})

function PageComponent() {
  const { q } = Route.useParams()

  return (
    <div>
      <p>{q}</p>
      <Outlet />
    </div>
  )
}
