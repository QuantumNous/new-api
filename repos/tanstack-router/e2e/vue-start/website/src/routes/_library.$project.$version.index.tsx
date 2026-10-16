import { Link, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/_library/$project/$version/')({
  component: Page,
})

function Page() {
  const params = Route.useParams()

  return (
    <div>
      <h1 class="text-2xl mb-2" data-testid="landing-page-heading">
        {params.value.project} landing page
      </h1>
      <p data-testid="landing-page-version">version: {params.value.version}</p>
      <p>
        <Link aria-label="Documentation" from="/$project/$version/" to="./docs">
          Get started with our documentation.
        </Link>
      </p>
    </div>
  )
}
