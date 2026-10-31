import { useNavigate } from '@tanstack/solid-router'
import { createSignal } from 'solid-js'
import { authClient } from '~/library/auth-client'
import { refreshAuth } from '~/library/convex-client'

export default function LoginSignupForm() {
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = createSignal(true)
  const [name, setName] = createSignal('')
  const [email, setEmail] = createSignal('')
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal('')
  const [loading, setLoading] = createSignal(false)

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isLogin()) {
        await authClient.signIn.email({
          email: email(),
          password: password(),
        })
      } else {
        await authClient.signUp.email({
          name: name(),
          email: email(),
          password: password(),
        })
      }

      refreshAuth()

      navigate({ to: '/dashboard' })
    } catch (err: any) {
      setError(err?.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-2xl shadow-xl p-8 md:p-10">
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">
              {isLogin() ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p class="text-gray-600 text-sm">
              {isLogin()
                ? 'Sign in to continue to your account'
                : 'Get started with your free account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} class="space-y-5">
            {!isLogin() && (
              <div>
                <label
                  for="name"
                  class="block text-sm font-medium text-gray-700 mb-2"
                >
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name()}
                  onInput={(e) => setName(e.currentTarget.value)}
                  required={!isLogin()}
                  class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400"
                  placeholder="John Doe"
                />
              </div>
            )}

            <div>
              <label
                for="email"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                for="password"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all duration-200 text-gray-900 placeholder-gray-400"
                placeholder="••••••••"
              />
            </div>

            {error() && (
              <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                <svg
                  class="w-5 h-5 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clip-rule="evenodd"
                  />
                </svg>
                <span>{error()}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading()}
              class={`w-full px-4 py-3 rounded-lg font-semibold text-white transition-all duration-200 ${
                loading()
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
              }`}
            >
              {loading() ? (
                <span class="flex items-center justify-center gap-2">
                  <svg
                    class="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </span>
              ) : isLogin() ? (
                'Sign In'
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div class="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin())
                setError('')
              }}
              class="text-sm text-gray-600 hover:text-blue-600 transition-colors duration-200 font-medium"
            >
              {isLogin() ? (
                <>
                  Don't have an account?{' '}
                  <span class="text-blue-600 hover:underline">Sign up</span>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <span class="text-blue-600 hover:underline">Sign in</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
