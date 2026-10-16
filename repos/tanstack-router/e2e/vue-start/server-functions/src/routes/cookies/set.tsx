import { createFileRoute } from '@tanstack/vue-router'
import { createServerFn } from '@tanstack/vue-start'
import { setCookie } from '@tanstack/vue-start/server'
import { z } from 'zod'
import Cookies from 'js-cookie'
import { defineComponent, ref, watch } from 'vue'

const cookieSchema = z.object({ value: z.string() })

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

const RouteComponent = defineComponent({
  setup() {
    const search = Route.useSearch()
    const cookiesFromDocument = ref<Record<string, string | undefined>>({})

    const updateCookies = () => {
      const tempCookies: Record<string, string | undefined> = {}
      for (let i = 1; i <= 4; i++) {
        const key = `cookie-${i}-${search.value.value}`
        tempCookies[key] = Cookies.get(key)
      }
      cookiesFromDocument.value = tempCookies
    }

    if (typeof window !== 'undefined') {
      watch(
        () => search.value.value,
        () => {
          updateCookies()
        },
        { immediate: true },
      )
    }

    return () => (
      <div>
        <h1 class="text-xl">cookies result</h1>
        <table>
          <tbody>
            <tr>
              <td>cookie</td>
              <td>value</td>
            </tr>
            {Object.entries(cookiesFromDocument.value).map(([key, value]) => (
              <tr>
                <td>{key}</td>
                <td data-testid={key}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  },
})

export const Route = createFileRoute('/cookies/set')({
  validateSearch: cookieSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    await setCookieServerFn1({ data: deps })
    await setCookieServerFn2({ data: deps })
  },
  component: RouteComponent,
})
