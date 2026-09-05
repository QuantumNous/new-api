import { createFileRoute } from '@tanstack/solid-router'
import { Link, linkOptions } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div class="p-2 grid gap-2">
      <h3>Welcome Home!</h3>
      <p>
        The are the links to be tested when navigating away from the index page.
        Otherwise known as NOT first-load tests, rather known as navigation
        tests.
      </p>
      {(
        [
          linkOptions({ to: '/normal-page' }),
          linkOptions({ to: '/lazy-page' }),
          linkOptions({ to: '/virtual-page' }),
          linkOptions({ to: '/lazy-with-loader-page' }),
          linkOptions({ to: '/page-with-search', search: { where: 'footer' } }),
        ] as const
      ).map((options, i) => (
        <div class="border p-2">
          <h4>{options.to} tests</h4>
          <p>
            <Link {...options} hash="at-the-bottom">
              {options.to}#at-the-bottom
            </Link>
          </p>
        </div>
      ))}
    </div>
  )
}
