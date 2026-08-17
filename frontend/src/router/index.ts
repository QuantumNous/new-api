import {
  createRouter,
  createWebHistory,
  type RouteLocationRaw,
} from 'vue-router'

import HomeView from '@/views/HomeView.vue'
import { getConsoleRouteAccessMeta } from '@/constants/navigation/consoleNav'
import { loadMessageDomain } from '@/i18n'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'
import { useSetupStore } from '@/stores/setup'

const CONSOLE_ENTRY: RouteLocationRaw = { name: 'dashboard' }
const CHUNK_RELOAD_KEY = 'ren2hub_chunk_reload'

export function sanitizeSetupRedirect(value: unknown): string | null {
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
    const pathname = url.pathname.replace(/^\/next(?=\/|$)/, '') || '/'
    if (pathname === '/setup/error') return null
    return `${pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

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
    const pathname = url.pathname.replace(/^\/next(?=\/|$)/, '') || '/'
    if (!/^(\/(console|lab))(\/|$)/.test(pathname)) return null
    return `${pathname}${url.search}${url.hash}`
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
      meta: { public: true, guestOnly: true, feature: 'registration' },
    },
    {
      path: '/auth/reset',
      name: 'reset',
      component: () => import('@/views/auth/ResetPasswordView.vue'),
      meta: { public: true, guestOnly: true },
    },
    {
      path: '/oauth/:provider',
      name: 'oauth-callback',
      component: () => import('@/views/auth/OAuthCallbackView.vue'),
      meta: { public: true },
    },
    {
      path: '/setup',
      name: 'setup',
      component: () => import('@/views/setup/SetupView.vue'),
      meta: { public: true, setupRoute: true },
    },
    {
      path: '/setup/error',
      name: 'setup-error',
      component: () => import('@/views/setup/SetupErrorView.vue'),
      meta: { public: true, setupError: true },
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
      meta: { requiresAuth: true, topNav: 'console' },
      children: [
        { path: '', redirect: { name: 'dashboard' } },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/console/DashboardView.vue'),
          meta: { topNav: 'dashboard', feature: 'dashboard_basic' },
        },
        {
          path: 'activity',
          name: 'activity',
          component: () => import('@/views/console/ActivityView.vue'),
          meta: {
            topNav: 'activities',
            feature: 'activity',
          },
        },
        {
          path: 'models',
          name: 'models',
          component: () => import('@/views/console/ModelsView.vue'),
          meta: { feature: 'user_models' },
        },
        {
          path: 'market',
          name: 'market',
          component: () => import('@/views/console/MarketplaceView.vue'),
          meta: {
            noPageScroll: true,
            protected: true,
            feature: 'marketplace',
          },
        },
        {
          path: 'keys',
          name: 'keys',
          component: () => import('@/views/console/KeysView.vue'),
          meta: {
            wide: true,
            noPageScroll: true,
            feature: 'legacy_token',
          },
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('@/views/console/LogsView.vue'),
          meta: { wide: true, noPageScroll: true, feature: 'logs' },
        },
        {
          path: 'logs/drawing',
          name: 'logs-drawing',
          component: () => import('@/views/console/DrawingLogsView.vue'),
          meta: {
            wide: true,
            noPageScroll: true,
            feature: 'logs',
            nav: 'logs',
          },
        },
        {
          path: 'logs/tasks',
          name: 'logs-tasks',
          component: () => import('@/views/console/TaskLogsView.vue'),
          meta: {
            wide: true,
            noPageScroll: true,
            feature: 'logs',
            nav: 'logs',
          },
        },
        {
          path: 'channels',
          name: 'channels',
          component: () => import('@/views/console/ChannelsView.vue'),
          meta: {
            wide: true,
            noPageScroll: true,
            feature: 'admin',
            ...getConsoleRouteAccessMeta('channels'),
          },
        },
        {
          path: 'ticket-management/:id?',
          name: 'ticket-management',
          component: () => import('@/views/console/AdminTicketsView.vue'),
          meta: {
            wide: true,
            noPageScroll: true,
            feature: 'admin',
            ...getConsoleRouteAccessMeta('ticket-management'),
          },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/views/console/UsersView.vue'),
          meta: {
            wide: true,
            noPageScroll: true,
            feature: 'admin',
            ...getConsoleRouteAccessMeta('users'),
          },
        },
        {
          path: 'redemption',
          name: 'redemption',
          component: () => import('@/views/console/RedemptionView.vue'),
          meta: {
            wide: true,
            noPageScroll: true,
            feature: 'admin',
            ...getConsoleRouteAccessMeta('redemption'),
          },
        },
        {
          path: 'plan-management',
          name: 'plan-management',
          component: () => import('@/views/console/PlanManagementView.vue'),
          meta: {
            wide: true,
            noPageScroll: true,
            protected: true,
            feature: 'subscription_balance',
            ...getConsoleRouteAccessMeta('plan-management'),
          },
        },
        {
          path: 'orders',
          name: 'orders',
          component: () => import('@/views/console/OrdersView.vue'),
          meta: {
            wide: true,
            noPageScroll: true,
            feature: 'orders',
            ...getConsoleRouteAccessMeta('orders'),
          },
        },
        {
          path: 'tickets',
          name: 'tickets',
          component: () => import('@/views/console/TicketsView.vue'),
          meta: {
            noPageScroll: true,
            feature: 'tickets',
          },
        },
        {
          path: 'tickets/:id',
          name: 'ticket-detail',
          component: () => import('@/views/console/TicketDetailView.vue'),
          meta: { nav: 'tickets', feature: 'tickets' },
        },
        {
          path: 'wallet',
          name: 'wallet',
          component: () => import('@/views/console/WalletView.vue'),
          meta: { feature: 'wallet' },
        },
        {
          path: 'subscription',
          name: 'subscription',
          component: () => import('@/views/console/SubscriptionView.vue'),
          meta: { protected: true, feature: 'subscription_balance' },
        },
        {
          path: 'invite',
          name: 'invite',
          component: () => import('@/views/console/InviteView.vue'),
          meta: { feature: 'invites' },
        },
        {
          path: 'invoice',
          name: 'invoice',
          component: () => import('@/views/console/InvoiceView.vue'),
          meta: { protected: true, feature: 'invoices' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/console/AccountSettingsView.vue'),
          meta: { feature: 'profile' },
        },
        {
          path: 'system-settings',
          name: 'system-settings',
          redirect: { name: 'system-settings-site' },
          component: () => import('@/views/console/SystemSettingsView.vue'),
          meta: { wide: true, feature: 'admin' },
          children: [
            {
              path: 'site',
              name: 'system-settings-site',
              component: () =>
                import('@/views/console/systemSettings/SiteSettingsView.vue'),
              meta: { wide: true, feature: 'admin' },
            },
            {
              path: 'auth',
              name: 'system-settings-auth',
              component: () =>
                import('@/views/console/systemSettings/AuthSettingsView.vue'),
              meta: { wide: true, feature: 'admin' },
            },
            {
              path: 'billing',
              name: 'system-settings-billing',
              component: () =>
                import('@/views/console/systemSettings/BillingSettingsView.vue'),
              meta: { wide: true, feature: 'admin' },
            },
            {
              path: 'models',
              name: 'system-settings-models',
              component: () =>
                import('@/views/console/systemSettings/ModelSettingsView.vue'),
              meta: { wide: true, feature: 'admin' },
            },
            {
              path: 'security',
              name: 'system-settings-security',
              component: () =>
                import('@/views/console/systemSettings/SecuritySettingsView.vue'),
              meta: { wide: true, feature: 'admin' },
            },
            {
              path: 'content',
              name: 'system-settings-content',
              component: () =>
                import('@/views/console/systemSettings/ContentSettingsView.vue'),
              meta: { wide: true, feature: 'admin' },
            },
            {
              path: 'operations',
              name: 'system-settings-operations',
              component: () =>
                import('@/views/console/systemSettings/OperationsSettingsView.vue'),
              meta: { wide: true, feature: 'admin' },
            },
          ],
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/console/AccountCenterView.vue'),
          meta: { feature: 'profile' },
        },
        {
          path: 'farm',
          name: 'farm',
          component: () => import('@/views/console/FarmView.vue'),
          meta: {
            topNav: 'activities',
            protected: true,
            feature: 'farm',
          },
        },
        {
          path: 'bigame',
          name: 'bigame',
          component: () => import('@/views/console/BigameView.vue'),
          meta: {
            topNav: 'activities',
            protected: true,
            feature: 'bigame',
          },
        },
      ],
    },
    {
      path: '/lab',
      component: () => import('@/components/layout/LabLayout.vue'),
      meta: {
        requiresAuth: true,
        topNav: 'alchemy',
        protected: true,
        feature: 'lab',
      },
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
  if (to.meta.setupError) {
    await loadMessageDomain('setup')
    return true
  }

  if (to.meta.setupRoute) await loadMessageDomain('setup')
  const setup = useSetupStore()
  try {
    const setupStatus = await setup.load()
    if (!setupStatus.status && !to.meta.setupRoute) {
      return { name: 'setup' }
    }
    if (setupStatus.status && to.meta.setupRoute) {
      return { name: 'home' }
    }
  } catch {
    return {
      name: 'setup-error',
      query: { redirect: to.fullPath },
    }
  }

  if (to.path.startsWith('/auth/')) {
    await loadMessageDomain('auth')
  } else if (to.path.startsWith('/console')) {
    await loadMessageDomain('console')
  } else if (to.path.startsWith('/lab')) {
    await Promise.all([loadMessageDomain('console'), loadMessageDomain('lab')])
  }

  if (to.meta.feature || to.name === 'sign-up') {
    const app = useAppStore()
    await app.initialize()
    const featureUnavailable =
      to.meta.feature &&
      ((to.meta.protected && !app.statusReachable) ||
        !app.isFeatureEnabled(
          to.meta.feature,
          to.meta.protected ? 'disabled' : 'live'
        ))
    if (featureUnavailable) {
      return to.name === 'dashboard' ? { name: 'home' } : CONSOLE_ENTRY
    }
    if (to.name === 'sign-up' && app.statusReachable && !app.registerEnabled) {
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
  if (
    to.meta.requiresPermission &&
    !auth.hasPermission(
      to.meta.requiresPermission.resource,
      to.meta.requiresPermission.action
    )
  ) {
    return CONSOLE_ENTRY
  }
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
