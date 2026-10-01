import {
  fetchSession,
  getCookieName,
} from '@convex-dev/better-auth/react-start'
import { createServerFn } from '@tanstack/solid-start'
import { redirect } from '@tanstack/solid-router'
import { getCookie, getRequest } from '@tanstack/solid-start/server'
import { api } from 'convex/_generated/api'
import { fetchMutation, fetchQuery } from './auth-server'

// Get auth information for SSR using available cookies
export const fetchAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const { createAuth } = await import('../../convex/auth')
  const request = getRequest()
  const { session } = await fetchSession(request)
  const sessionCookieName = getCookieName(createAuth)
  const token = getCookie(sessionCookieName)

  return {
    session,
    token,
  }
})

export const fetchUser = createServerFn({ method: 'GET' }).handler(async () => {
  try {
    const user = await fetchQuery(api.auth.getCurrentUser, {})
    return user
  } catch (error) {
    throw redirect({ to: '/' })
  }
})

// example of calling Convex functions using server functions
export const addNumber = createServerFn({ method: 'POST' }).handler(
  async () => {
    const number = await fetchMutation(api.myFunctions.addNumber, {
      value: Math.floor(Math.random() * 100),
    })
    return number
  },
)
