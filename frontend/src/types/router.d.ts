import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    guestOnly?: boolean
    requiresAuth?: boolean
    requiresAdmin?: boolean
    requiresRoot?: boolean
    noPageScroll?: boolean
    wide?: boolean
    nav?: string
  }
}
