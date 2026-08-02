import {
  createRouter,
  createWebHistory,
  type RouteLocationRaw,
} from 'vue-router'

import HomeView from '@/views/HomeView.vue'
import { loadMessageDomain } from '@/i18n'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'

const CONSOLE_ENTRY: RouteLocationRaw = { name: 'dashboard' }
const CHUNK_RELOAD_KEY = 'ren2hub_chunk_reload'

export function sanitizeRedirect(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//')
  ) {
    return null
  }

  try {
    const url = new URL(value, window.location.origin)
    if (url.origin !== window.location.origin) return null
    if (!/^\/(console|lab)(\/|$)/.test(url.pathname)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { public: true },
    },
    { path: '/home', redirect: { name: 'home' } },
    {
      path: '/auth/sign-in',
      name: 'sign-in',
      component: () => import('@/views/auth/SignInView.vue'),
      meta: { public: true, guestOnly: true },
    },
    {
      path: '/auth/sign-up',
      name: 'sign-up',
      component: () => import('@/views/auth/SignUpView.vue'),
      meta: { public: true, guestOnly: true },
    },
    {
      path: '/auth/reset',
      name: 'reset',
      component: () => import('@/views/auth/ResetPasswordView.vue'),
      meta: { public: true, guestOnly: true },
    },
    {
      path: '/sign-in',
      redirect: (to) => ({ name: 'sign-in', query: to.query }),
    },
    {
      path: '/sign-up',
      redirect: (to) => ({ name: 'sign-up', query: to.query }),
    },
    { path: '/dashboard', redirect: { name: 'dashboard' } },
    { path: '/pricing', redirect: { name: 'models' } },
    {
      path: '/console',
      component: () => import('@/components/layout/ConsoleLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'dashboard' } },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/console/DashboardView.vue'),
        },
        {
          path: 'activity',
          name: 'activity',
          component: () => import('@/views/console/ActivityView.vue'),
        },
        {
          path: 'models',
          name: 'models',
          component: () => import('@/views/console/ModelsView.vue'),
        },
        {
          path: 'market',
          name: 'market',
          component: () => import('@/views/console/MarketplaceView.vue'),
          meta: { noPageScroll: true },
        },
        {
          path: 'keys',
          name: 'keys',
          component: () => import('@/views/console/KeysView.vue'),
          meta: { wide: true, noPageScroll: true },
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('@/views/console/LogsView.vue'),
          meta: { wide: true, noPageScroll: true },
        },
        {
          path: 'channels',
          name: 'channels',
          component: () => import('@/views/console/ChannelsView.vue'),
          meta: {
            wide: true,
            noPageScroll: true,
            requiresAdmin: true,
          },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/console/UsersView.vue'),
          meta: { wide: true, noPageScroll: true, requiresAdmin: true },
        },
        {
          path: 'redemption',
          name: 'redemption',
          component: () => import('@/views/console/RedemptionView.vue'),
          meta: { wide: true, noPageScroll: true, requiresAdmin: true },
        },
        {
          path: 'plan-management',
          name: 'plan-management',
          component: () => import('@/views/console/PlanManagementView.vue'),
          meta: { wide: true, noPageScroll: true, requiresAdmin: true },
        },
        {
          path: 'orders',
          name: 'orders',
          component: () => import('@/views/console/OrdersView.vue'),
          meta: { wide: true, noPageScroll: true, requiresAdmin: true },
        },
        {
          path: 'tickets',
          name: 'tickets',
          component: () => import('@/views/console/TicketsView.vue'),
          meta: { noPageScroll: true },
        },
        {
          path: 'tickets/:id',
          name: 'ticket-detail',
          component: () => import('@/views/console/TicketDetailView.vue'),
          meta: { nav: 'tickets' },
        },
        {
          path: 'wallet',
          name: 'wallet',
          component: () => import('@/views/console/WalletView.vue'),
        },
        {
          path: 'subscription',
          name: 'subscription',
          component: () => import('@/views/console/SubscriptionView.vue'),
        },
        {
          path: 'invite',
          name: 'invite',
          component: () => import('@/views/console/InviteView.vue'),
        },
        {
          path: 'invoice',
          name: 'invoice',
          component: () => import('@/views/console/InvoiceView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/console/SettingsView.vue'),
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/console/ProfileView.vue'),
        },
        {
          path: 'farm',
          name: 'farm',
          component: () => import('@/views/console/FarmView.vue'),
        },
        {
          path: 'bigame',
          name: 'bigame',
          component: () => import('@/views/console/BigameView.vue'),
        },
      ],
    },
    {
      path: '/lab',
      component: () => import('@/components/layout/LabLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'lab-chat' } },
        {
          path: 'chat',
          name: 'lab-chat',
          component: () => import('@/views/lab/ChatView.vue'),
        },
        {
          path: 'chat/:id',
          name: 'lab-chat-session',
          component: () => import('@/views/lab/ChatView.vue'),
          meta: { nav: 'lab-chat' },
        },
        {
          path: 'studio',
          name: 'lab-studio',
          component: () => import('@/views/lab/StudioView.vue'),
        },
        {
          path: 'assets',
          name: 'lab-assets',
          component: () => import('@/views/lab/AssetsView.vue'),
        },
        {
          path: 'notes',
          name: 'lab-notes',
          component: () => import('@/views/lab/NotesView.vue'),
        },
        {
          path: 'plugins',
          name: 'lab-plugins',
          component: () => import('@/views/lab/PluginsView.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { public: true },
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  if (to.path.startsWith('/auth/')) {
    await loadMessageDomain('auth')
  } else if (to.path.startsWith('/console')) {
    await loadMessageDomain('console')
  } else if (to.path.startsWith('/lab')) {
    await Promise.all([loadMessageDomain('console'), loadMessageDomain('lab')])
  }

  if (to.name === 'sign-up') {
    const app = useAppStore()
    await app.initialize()
    if (app.statusReachable && !app.registerEnabled) {
      return { name: 'sign-in' }
    }
  }

  if (!to.meta.requiresAuth && !to.meta.guestOnly) return true

  const auth = useAuthStore()
  if (!auth.checked) await auth.fetchSelf()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: 'sign-in',
      query: {
        redirect: sanitizeRedirect(to.fullPath) ?? '/console/dashboard',
      },
    }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) return CONSOLE_ENTRY
  if (to.meta.requiresRoot && !auth.isRoot) return CONSOLE_ENTRY
  if (to.meta.requiresAdmin && !auth.isAdmin) return CONSOLE_ENTRY
  return true
})

router.onError((error) => {
  const chunkFailed =
    /Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      error.message
    )
  if (!chunkFailed || window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1')
    return

  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
  window.location.reload()
})

router.afterEach(() => {
  window.sessionStorage.removeItem(CHUNK_RELOAD_KEY)
})

export default router
