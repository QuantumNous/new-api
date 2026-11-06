import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/nested/$a/$b/$c/$d/$e/$f/$g/$h/$i/$j/$k/$l/$m/$n/$o/$p/$q/$r/$s/$t/$u/$v/$w/$x/$y/$z',
)({
  component: PageComponent,
})

function PageComponent() {
  const { z } = Route.useParams()

  return (
    <div>
      <p>{z}</p>
    </div>
  )
}
