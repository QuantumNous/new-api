import { setupConvex } from 'convex-solidjs'
import { fetchAuth } from '~/library/server'

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL
if (!CONVEX_URL) {
  throw new Error('missing envar CONVEX_URL')
}

// Set up Convex client with auth
export const convexClient = setupConvex(CONVEX_URL)

// Configure auth token fetcher
export function refreshAuth() {
  convexClient.setAuth(async () => {
    const { token } = await fetchAuth()
    return token
  })
}

refreshAuth()
