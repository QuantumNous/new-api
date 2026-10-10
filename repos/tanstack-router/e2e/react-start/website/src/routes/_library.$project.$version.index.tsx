import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_library/$project/$version/')({
  component: Page,
})

function Page() {
  const params = Route.useParams()

  return (
    <div>
      <h1 className="text-2xl mb-2" data-testid="landing-page-heading">
        {params.project} landing page
      </h1>
      <p data-testid="landing-page-version">version: {params.version}</p>
      <p>
        <Link
          aria-label="Documentation"
          from="/$project/$version/"
          to="/$project/$version/docs"
        >
          Get started with our documentation.
        </Link>
      </p>
    </div>
  )
}
