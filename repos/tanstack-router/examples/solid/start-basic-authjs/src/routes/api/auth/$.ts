import { createFileRoute } from '@tanstack/solid-router'
import { StartAuthJS } from 'start-authjs'
import { authConfig } from '~/utils/auth'

/**
 * Auth.js API route handler
 * Handles all auth routes: /api/auth/*
 */
const { GET, POST } = StartAuthJS(authConfig)

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => GET({ request, response: new Response() }),
      POST: ({ request }) => POST({ request, response: new Response() }),
    },
  },
})
