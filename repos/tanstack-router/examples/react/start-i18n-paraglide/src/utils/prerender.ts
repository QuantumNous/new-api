import { localizeHref } from '../paraglide/runtime'

export const prerenderRoutes = ['/', '/about'].map((path) => ({
  path: localizeHref(path),
  prerender: {
    enabled: true,
  },
}))
