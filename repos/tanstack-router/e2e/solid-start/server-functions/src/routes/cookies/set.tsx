import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'
import { setCookie } from '@tanstack/solid-start/server'
import { z } from 'zod'
import Cookies from 'js-cookie'
import * as Solid from 'solid-js'

const cookieSchema = z.object({ value: z.string() })

export const Route = createFileRoute('/cookies/set')({
  validateSearch: cookieSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    await setCookieServerFn1({ data: deps })
    await setCookieServerFn2({ data: deps })
  },
  component: RouteComponent,
})

export const setCookieServerFn1 = createServerFn()
  .validator(cookieSchema)
  .handler(({ data }) => {
    setCookie(`cookie-1-${data.value}`, data.value)
    setCookie(`cookie-2-${data.value}`, data.value)
  })

export const setCookieServerFn2 = createServerFn()
  .validator(cookieSchema)
  .handler(({ data }) => {
    setCookie(`cookie-3-${data.value}`, data.value)
    setCookie(`cookie-4-${data.value}`, data.value)
  })

function RouteComponent() {
  const search = Route.useSearch()
  const [cookiesFromDocument, setCookiesFromDocument] = Solid.createSignal<
    Record<string, string | undefined> | undefined
  >(undefined)
  Solid.createEffect(() => {
    const tempCookies: Record<string, string | undefined> = {}
    for (let i = 1; i <= 4; i++) {
      const key = `cookie-${i}-${search().value}`
      tempCookies[key] = Cookies.get(key)
    }
    setCookiesFromDocument(tempCookies)
  }, [])
  return (
    <div>
      <h1 class="text-xl">cookies result</h1>
      <table>
        <tbody>
          <tr>
            <td>cookie</td>
            <td>value</td>
          </tr>
          {Object.entries(cookiesFromDocument() || {}).map(([key, value]) => (
            <tr>
              <td>{key}</td>
              <td data-testid={key}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
