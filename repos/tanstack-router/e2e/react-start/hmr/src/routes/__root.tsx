/// <reference types="vite/client" />
import {
  ClientOnly,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  isMatch,
  useMatches,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import '~/styles/app.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
  }),
  loader: () => ({
    crumb: 'Home',
  }),
  component: RootComponent,
})

function Breadcrumbs() {
  const matches = useMatches()
  const matchesWithCrumbs = matches.filter((match) =>
    isMatch(match, 'loaderData.crumb'),
  )

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {matchesWithCrumbs.map((match, index) => (
        <span className="flex items-center gap-2" key={match.id}>
          {index > 0 ? (
            <span className="text-slate-400" aria-hidden>
              /
            </span>
          ) : null}
          <span
            className="rounded-full bg-[rgba(31,111,120,0.10)] px-3 py-1 text-sm font-semibold text-[var(--color-lagoon)]"
            data-testid={`crumb-${match.routeId}`}
          >
            {match.loaderData?.crumb}
          </span>
        </span>
      ))}
    </nav>
  )
}

function RootComponent() {
  return (
    <RootDocument marker="root-component-baseline">
      <RootContent />
    </RootDocument>
  )
}

function RootDocument({
  children,
  marker,
}: {
  children: ReactNode
  marker: string
}) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body className="hmr-shell">
        <div className="hidden" aria-hidden="true">
          <p data-testid="root-component-marker">{marker}</p>
        </div>
        <div className="pointer-events-none fixed right-4 top-4 z-20 hidden sm:block">
          <div className="rounded-full border border-white/70 bg-white/75 px-4 py-2 shadow-lg backdrop-blur">
            <span className="hmr-label">Current marker </span>
            <span className="hmr-kbd">{marker}</span>
          </div>
        </div>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootShellDocument({
  children,
  marker,
}: {
  children: ReactNode
  marker: string
}) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body className="hmr-shell">
        <div className="hidden" aria-hidden="true">
          <p data-testid="root-shell-marker">{marker}</p>
        </div>
        <div className="hmr-shell" data-testid="root-shell">
          {children}
        </div>
        <Scripts />
      </body>
    </html>
  )
}

function RootContent() {
  const navLinks = [
    {
      testId: 'home-link',
      to: '/',
      label: 'Home',
      detail: 'Local state + route option HMR',
    },
    {
      testId: 'child-link',
      to: '/child',
      label: 'Child',
      detail: 'Loader and beforeLoad updates',
    },
    {
      testId: 'inputs-link',
      to: '/inputs',
      label: 'Inputs',
      detail: 'Uncontrolled input preservation',
    },
    {
      testId: 'component-hmr-link',
      to: '/component-hmr',
      label: 'Component HMR',
      detail: 'Base component refresh checks',
    },
    {
      testId: 'server-fn-hmr-link',
      to: '/server-fn-hmr',
      label: 'Server Fn HMR',
      detail: 'Transitive invalidation for server functions',
    },
    {
      testId: 'component-hmr-inline-split-link',
      to: '/component-hmr-inline-split',
      label: 'Inline Split',
      detail: 'Inline component with default splitting',
    },
    {
      testId: 'component-hmr-inline-nosplit-link',
      to: '/component-hmr-inline-nosplit',
      label: 'Inline No Split',
      detail: 'Inline component with code splitting disabled',
    },
    {
      testId: 'component-hmr-named-split-link',
      to: '/component-hmr-named-split',
      label: 'Named Split',
      detail: 'Named component with default splitting',
    },
    {
      testId: 'component-hmr-named-nosplit-link',
      to: '/component-hmr-named-nosplit',
      label: 'Named No Split',
      detail: 'Named component with code splitting disabled',
    },
    {
      testId: 'component-hmr-inline-error-split-link',
      to: '/component-hmr-inline-error-split',
      label: 'Inline Error Split',
      detail: 'Inline component with only errorComponent split',
    },
    {
      testId: 'component-hmr-named-error-split-link',
      to: '/component-hmr-named-error-split',
      label: 'Named Error Split',
      detail: 'Named component with only errorComponent split',
    },
  ] as const

  return (
    <div className="hmr-page">
      <header className="hmr-hero">
        <div className="relative z-10 flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-3">
              <p className="hmr-label">React Start HMR Playground</p>
              <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--color-night)] sm:text-5xl">
                Route refresh behavior
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                This sandbox exercises component state preservation, route
                option updates, stale data clearing, and split-route refresh
                behavior.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="hmr-label">Route matrix</span>
                <span className="text-xs font-medium text-slate-500">
                  Stable test ids preserved
                </span>
              </div>
              <div className="hmr-nav-grid">
                {navLinks.map((link) => (
                  <Link
                    activeProps={{
                      className:
                        'group hmr-nav-link border-[var(--color-reef)] bg-white shadow-md',
                    }}
                    className="group hmr-nav-link"
                    data-testid={link.testId}
                    key={link.testId}
                    to={link.to}
                  >
                    <span className="font-display text-lg font-semibold text-[var(--color-night)]">
                      {link.label}
                    </span>
                    <span className="text-sm leading-5 text-slate-600 group-hover:text-slate-700">
                      {link.detail}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="hmr-card flex flex-col gap-4">
              <div>
                <p className="hmr-label">Root state</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  This uncontrolled input is used by the tests to verify
                  root-level state survives route and component HMR updates.
                </p>
              </div>
              <input
                className="hmr-input"
                data-testid="root-message"
                defaultValue="root state"
              />
              <div className="space-y-2">
                <p className="hmr-label">Breadcrumbs</p>
                <Breadcrumbs />
              </div>
              <ClientOnly>
                <p
                  className="inline-flex w-fit items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700"
                  data-testid="hydrated"
                >
                  hydrated
                </p>
              </ClientOnly>
            </div>
          </div>
        </div>
      </header>

      <div className="pb-8">
        <Outlet />
      </div>
    </div>
  )
}
