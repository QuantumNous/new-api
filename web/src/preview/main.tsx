import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
/** GitHub Pages entry point: public design review only, with no backend or authentication. */
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'

import { ThemeProvider } from '@/context/theme-provider'
import {
  OrbitLanding,
  OrbitModelHub,
  OrbitPublicPage,
} from '@/features/home/components/orbit-landing'
import { OrbitDocumentation, PlannedProgram } from '@/features/orbit-community'
import { ORBIT_BRAND } from '@/lib/orbit-brand'

import '@/styles/index.css'

const previewQueryClient = new QueryClient({
  defaultOptions: {
    queries: { enabled: false, retry: false, staleTime: Infinity },
  },
})
previewQueryClient.setQueryData(['status'], { register_enabled: true })

const root = createRootRoute({
  component: () => (
    <QueryClientProvider client={previewQueryClient}>
      <ThemeProvider>
        <Outlet />
        <aside className='orbit-preview-notice' aria-label='Preview status'>
          Temporary design preview · Account and API operations are unavailable.{' '}
          <a
            className='underline'
            href='https://github.com/Pratik2k25/BEU-Developer-Orbit/tree/feature/orbit-phase1-wusrouter-replica'
          >
            Preview source
          </a>
        </aside>
      </ThemeProvider>
    </QueryClientProvider>
  ),
})
export function PreviewOnly() {
  return (
    <OrbitPublicPage title='Design preview only'>
      <p>
        This temporary GitHub Pages preview cannot run the Go gateway, create
        accounts, sign you in, issue API keys, or send model requests. The full
        application is being tested separately in the cloud workspace.
      </p>
      <p>
        <Link to='/'>Return to Orbit</Link> ·{' '}
        <a href={ORBIT_BRAND.source}>View the source repository</a>
      </p>
    </OrbitPublicPage>
  )
}
const legalTitles: Record<string, string> = {
  '/terms': 'Terms of Service',
  '/privacy': 'Privacy',
  '/contact': 'Contact Orbit',
}
const routes = [
  createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <OrbitLanding isAuthenticated={false} />,
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/model-hub',
    component: OrbitModelHub,
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/docs',
    component: OrbitDocumentation,
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/student-verification',
    component: () => <PlannedProgram program='students' />,
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/college-sponsorship',
    component: () => <PlannedProgram program='sponsorship' />,
  }),
  createRoute({
    getParentRoute: () => root,
    path: '/requests',
    component: () => <PlannedProgram program='requests' />,
  }),
  ...['/sign-in', '/sign-up', '/dashboard', '/keys', '/pricing'].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: PreviewOnly })
  ),
  createRoute({
    getParentRoute: () => root,
    path: '/access-limits',
    component: () => (
      <OrbitPublicPage title='Access & Limits' active='/access-limits'>
        <p>Planned policy · Not implemented by this interface.</p>
        <h2>Unverified accounts</h2>
        <p>
          10 requests per minute. 1 million chargeable tokens per four-hour
          window. 4 million chargeable tokens per day.
        </p>
        <h2>Verified BEU students</h2>
        <p>
          15 requests per minute. Standard token caps removed, subject to fair
          use and provider availability. Verification and limit-increase
          requests are planned.
        </p>
      </OrbitPublicPage>
    ),
  }),
  ...['/terms', '/privacy', '/contact'].map((path) =>
    createRoute({
      getParentRoute: () => root,
      path,
      component: () => (
        <OrbitPublicPage title={legalTitles[path]} active={path}>
          <p>
            This temporary design preview does not provide gateway access or
            accept personal documents. Final service terms, privacy details,
            retention policy, and operator contacts must be published before a
            public service launch.
          </p>
          <p>
            Report software issues in the{' '}
            <a href={ORBIT_BRAND.source}>Orbit repository</a>. Do not include
            personal data or secrets.
          </p>
        </OrbitPublicPage>
      ),
    })
  ),
]
const router = createRouter({
  routeTree: root.addChildren(routes),
  basepath: '/BEU-Developer-Orbit',
})
const element = document.querySelector('#root')
if (!element) throw new Error('Preview root element not found')
createRoot(element).render(<RouterProvider router={router} />)
