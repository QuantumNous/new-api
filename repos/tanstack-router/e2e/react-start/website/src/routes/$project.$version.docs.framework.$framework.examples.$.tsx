import { createFileRoute } from '@tanstack/react-router'
import { NotFound } from '~/components/NotFound'
import { capitalize, seo } from '~/utils/seo'

export const Route = createFileRoute(
  '/$project/$version/docs/framework/$framework/examples/$',
)({
  head: ({ params }) => ({
    meta: seo({
      title: `${capitalize(params._splat || '')} Example | TanStack ${capitalize(params.project)} ${capitalize(params.framework)}`,
    }),
  }),
  component: Page,
  notFoundComponent: () => {
    return <NotFound>Example not found</NotFound>
  },
})

function Page() {
  const params = Route.useParams()

  return (
    <div className="space-y-2">
      <h4
        data-testid="selected-example-heading"
        className="text-xl font-bold underline"
      >
        {params._splat} example
      </h4>
    </div>
  )
}
