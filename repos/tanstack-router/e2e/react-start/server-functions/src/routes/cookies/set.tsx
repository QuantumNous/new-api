import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'
import Cookies from 'js-cookie'
import React, { useEffect } from 'react'

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
  const { value: expectedCookieValue } = Route.useSearch()
  const [cookiesFromDocument, setCookiesFromDocument] = React.useState<
    Record<string, string | undefined> | undefined
  >(undefined)
  useEffect(() => {
    const tempCookies: Record<string, string | undefined> = {}
    for (let i = 1; i <= 4; i++) {
      const key = `cookie-${i}-${expectedCookieValue}`
      tempCookies[key] = Cookies.get(key)
    }
    setCookiesFromDocument(tempCookies)
  }, [])
  return (
    <div>
      <h1 className="text-xl">cookies result</h1>
      <table>
        <tbody>
          <tr>
            <td>cookie</td>
            <td>value</td>
          </tr>
          {Object.entries(cookiesFromDocument || {}).map(([key, value]) => (
            <tr key={key}>
              <td>{key}</td>
              <td data-testid={key}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
