import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { pageStyles } from '~/utils/styles'

const getCookies = createServerFn({
  method: 'GET',
}).handler(async () => {
  return getRequestHeaders().get('cookie') ?? ''
})

export const Route = createFileRoute('/rsc-request-headers')({
  loader: async () => {
    const cookies = await getCookies()

    return {
      cookies,
    }
  },
  component: RscRequestHeadersComponent,
})

function RscRequestHeadersComponent() {
  const { cookies } = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-request-headers-title" style={pageStyles.title}>
        RSC Request Headers
      </h1>
      <p style={pageStyles.description}>
        A route loader calling a server function can read request headers in the
        RSC environment.
      </p>
      <pre data-testid="rsc-request-headers-cookies">{cookies}</pre>
    </div>
  )
}
