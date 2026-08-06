import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    guestOnly?: boolean
    requiresAuth?: boolean
    requiresAdmin?: boolean
    requiresRoot?: boolean
    requiresPermission?: { resource: string; action: string }
    noPageScroll?: boolean
    wide?: boolean
    prototype?: boolean
    nav?: string
    topNav?: 'activities' | 'dashboard' | 'console' | 'alchemy'
  }
}
