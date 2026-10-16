import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k/$l/$m/$n/$o/$p/$q/$r/$s/$t',
)({
  component: PageComponent,
})

function PageComponent() {
  const { t } = Route.useParams()

  return (
    <div>
      <p>{t}</p>
      <Outlet />
    </div>
  )
}
