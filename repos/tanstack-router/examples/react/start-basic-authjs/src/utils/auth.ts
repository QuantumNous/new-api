import Auth0 from '@auth/core/providers/auth0'
import { setCookie } from '@tanstack/react-start/server'
import type { Profile } from '@auth/core/types'
import type { StartAuthJSConfig } from 'start-authjs'

declare module '@auth/core/types' {
  export interface Session {
    user: {
      name: string
      email: string
      sub: string
      email_verified: boolean
    } & Profile
    account: {
      access_token: string
    }
    expires: Date
  }
}

/**
 * Auth.js configuration for TanStack Start with Auth0
 */
export const authConfig: StartAuthJSConfig = {
  // basePath is derived from AUTH_URL env var
  secret: process.env.AUTH_SECRET,
  providers: [
    Auth0({
      // Auth.js auto-reads AUTH_AUTH0_ID, AUTH_AUTH0_SECRET, AUTH_AUTH0_ISSUER from env
      authorization: {
        params: {
          scope: 'email email_verified openid profile',
          prompt: 'login',
        },
      },
      async profile(profile, tokens) {
        await setCookie(
          'auth0Token',
          encodeURIComponent(tokens.access_token ?? ''),
        )
        await setCookie(
          'auth0User',
          encodeURIComponent(JSON.stringify(profile)),
        )

        return profile
      },
    }),
  ],
}
