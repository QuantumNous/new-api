import { createFileRoute, redirect } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'
import { setCookie } from '@tanstack/solid-start/server'

const setMultipleCookiesAndRedirect = createServerFn().handler(() => {
  // Set multiple cookies before redirecting
  // This tests that multiple Set-Cookie headers are preserved during redirect
  setCookie('session', 'session-value', { path: '/' })
  setCookie('csrf', 'csrf-token-value', { path: '/' })
  setCookie('theme', 'dark', { path: '/' })

  throw redirect({ to: '/multi-cookie-redirect/target' })
})

export const Route = createFileRoute('/multi-cookie-redirect/')({
  loader: () => setMultipleCookiesAndRedirect(),
  component: () => null,
})
