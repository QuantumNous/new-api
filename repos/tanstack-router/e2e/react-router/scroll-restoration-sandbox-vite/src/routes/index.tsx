import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Link, linkOptions } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomeComponent,
})

function HomeComponent() {
  return (
    <div className="p-2 grid gap-2">
      <h3>Welcome Home!</h3>
      <p>
        The are the links to be tested when navigating away from the index page.
        Otherwise known as NOT first-load tests, rather known as navigation
        tests.
      </p>
      {(
        [
          linkOptions({ to: '/issue-7040-source' }),
          linkOptions({ to: '/issue-7040-target' }),
          linkOptions({ to: '/normal-page' }),
          linkOptions({ to: '/lazy-page' }),
          linkOptions({ to: '/virtual-page' }),
          linkOptions({ to: '/lazy-with-loader-page' }),
          linkOptions({ to: '/page-with-search', search: { where: 'footer' } }),
        ] as const
      ).map((options, i) => (
        <div key={`index-page-tests-${options.to}-${i}`} className="border p-2">
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
