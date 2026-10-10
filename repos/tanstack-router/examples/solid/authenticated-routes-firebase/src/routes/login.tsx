import {
  createFileRoute,
  redirect,
  useRouter,
  useRouterState,
} from '@tanstack/solid-router'
import { z } from 'zod'

import {
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
} from 'firebase/auth'
import { useAuth } from '../auth'
import { sleep } from '../utils'
import { siApple, siGithub, siGoogle } from 'simple-icons'

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
const fallback = '/dashboard' as const

export const Route = createFileRoute('/login')({
  validateSearch: z.object({
    redirect: z.string().optional().catch(''),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated()) {
      throw redirect({ to: search.redirect || fallback })
    }
  },
  component: LoginComponent,
})

function LoginComponent() {
  const router = useRouter()
  const { login } = useAuth()

  const handleSignIn = async (provider: 'github') => {
    console.log(`Clicked ${provider} sign in!`)
    try {
      const providers = {
        github: new GithubAuthProvider(),
        // Other providers can be allocated here
      }

      const typedProvider =
        providers[provider] ??
        (() => {
          throw new Error('Invalid provider')
        })()

      await login(typedProvider)
      router.invalidate() // This should force the user to route to /dashboard
    } catch (error) {
      console.error('Sign in error:', error)
    }
  }

  return (
    <div class="flex justify-center items-center min-h-screen">
      <div class="w-full max-w-md px-4 animate-fade-up relative z-10">
        <div class="w-full backdrop-blur-xs bg-card/80 p-8 space-y-8 shadow-md border border-border">
          <div class="space-y-4">
            {/* biome-ignore lint/a11y/useButtonType: <explanation> */}
            <button
              class="w-full h-12 font-medium bg-background hover:bg-secondary border-2 transition-all hover:scale-[1.02]"
              onClick={() => handleSignIn('github')}
            >
              <div class="flex items-center justify-center w-full">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  class="mr-2 h-5 w-5"
                  fill="currentColor"
                  aria-labelledby="githubIconTitle"
                  role="img"
                  style={{ 'min-width': '20px' }}
                >
                  <title id="githubIconTitle">GitHub Logo</title>
                  <path d={siGithub.path} />
                </svg>
                <span>Continue with GitHub</span>
              </div>
            </button>
          </div>

          <div class="text-center text-sm text-muted-foreground">
            By continuing, you agree to our{' '}
            <a
              href="#"
              class="underline underline-offset-4 hover:text-primary transition-colors"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="#"
              class="underline underline-offset-4 hover:text-primary transition-colors"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
