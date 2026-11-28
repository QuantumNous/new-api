import { createRouter } from '@tanstack/vue-router'
import { routeTree } from './routeTree.gen'

const localePrefixRe = /^\/(fr|de|es)(\/.*)$/

export function getRouter() {
  return createRouter({
    routeTree,
    basepath: '/app',
    defaultPreload: false,
    scrollRestoration: false,
    rewrite: {
      input: ({ url }) => {
        const match = url.pathname.match(localePrefixRe)

        if (match) {
          url.pathname = match[2]!
          url.searchParams.set('_locale', match[1]!)
          return url
        }

        return undefined
      },
      output: ({ url }) => {
        const locale = url.searchParams.get('_locale')

        if (locale) {
          url.searchParams.delete('_locale')
          url.pathname = `/${locale}${url.pathname}`
        }

        return url
      },
    },
  })
}

declare module '@tanstack/vue-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
