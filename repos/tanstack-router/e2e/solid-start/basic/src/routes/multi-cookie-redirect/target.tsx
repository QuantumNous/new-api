import { createFileRoute } from '@tanstack/solid-router'
import Cookies from 'js-cookie'
import * as Solid from 'solid-js'

export const Route = createFileRoute('/multi-cookie-redirect/target')({
  component: RouteComponent,
})

function RouteComponent() {
  const [cookies, setCookies] = Solid.createSignal<Record<string, string>>({})

  Solid.onMount(() => {
    setCookies({
      session: Cookies.get('session') || '',
      csrf: Cookies.get('csrf') || '',
      theme: Cookies.get('theme') || '',
    })
  })

  return (
    <div>
      <h1 data-testid="multi-cookie-redirect-target">
        Multi Cookie Redirect Target
      </h1>
      <div>
        <p>
          Session cookie:{' '}
          <span data-testid="cookie-session">{cookies().session}</span>
        </p>
        <p>
          CSRF cookie: <span data-testid="cookie-csrf">{cookies().csrf}</span>
        </p>
        <p>
          Theme cookie:{' '}
          <span data-testid="cookie-theme">{cookies().theme}</span>
        </p>
      </div>
    </div>
  )
}
