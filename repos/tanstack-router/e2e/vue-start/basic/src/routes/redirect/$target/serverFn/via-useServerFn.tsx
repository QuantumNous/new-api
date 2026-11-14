import { createFileRoute } from '@tanstack/vue-router'
import { RedirectOnClick } from '~/components/RedirectOnClick'

export const Route = createFileRoute(
  '/redirect/$target/serverFn/via-useServerFn',
)({
  component: () => {
    const params = Route.useParams()
    const search = Route.useSearch()
    return (
      <RedirectOnClick
        target={params.value.target}
        reloadDocument={search.value.reloadDocument}
        externalHost={search.value.externalHost}
      />
    )
  },
})
