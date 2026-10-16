import { createFileRoute } from '@tanstack/react-router'
import Cookies from 'js-cookie'
import React, { useEffect } from 'react'

export const Route = createFileRoute('/multi-cookie-redirect/target')({
  component: RouteComponent,
})

function RouteComponent() {
  const [cookies, setCookies] = React.useState<Record<string, string>>({})

  useEffect(() => {
    setCookies({
      session: Cookies.get('session') || '',
      csrf: Cookies.get('csrf') || '',
      theme: Cookies.get('theme') || '',
    })
  }, [])

  return (
    <div>
      <h1 data-testid="multi-cookie-redirect-target">
        Multi Cookie Redirect Target
      </h1>
      <div>
        <p>
          Session cookie:{' '}
          <span data-testid="cookie-session">{cookies.session}</span>
        </p>
        <p>
          CSRF cookie: <span data-testid="cookie-csrf">{cookies.csrf}</span>
        </p>
        <p>
          Theme cookie: <span data-testid="cookie-theme">{cookies.theme}</span>
        </p>
      </div>
    </div>
  )
}
