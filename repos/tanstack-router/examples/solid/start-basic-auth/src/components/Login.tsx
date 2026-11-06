import { useRouter } from '@tanstack/solid-router'
import { useServerFn } from '@tanstack/solid-start'
import { useMutation } from '../hooks/useMutation'
import { loginFn } from '../routes/_authed'
import { Auth } from './Auth'
import { signupFn } from '~/routes/signup'

export function Login() {
  const router = useRouter()

  const loginMutation = useMutation({
    fn: loginFn,
    onSuccess: async (ctx) => {
      if (!ctx.data?.error) {
        await router.invalidate()
        router.navigate({ to: '/' })
        return
      }
    },
  })

  const signupMutation = useMutation({
    fn: useServerFn(signupFn),
  })

  return (
    <Auth
      actionText="Login"
      status={loginMutation.status()}
      onSubmit={(e) => {
        const formData = new FormData(e.target as any as HTMLFormElement)

        loginMutation.mutate({
          data: {
            email: formData.get('email') as string,
            password: formData.get('password') as string,
          },
        })
      }}
      afterSubmit={
        loginMutation.data() ? (
          <>
            <div class="text-red-400">{loginMutation.data()?.message}</div>
            {loginMutation.data()?.userNotFound ? (
              <div>
                <button
                  class="text-blue-500"
                  onClick={(e) => {
                    const formData = new FormData(
                      (e.target as HTMLButtonElement).form!,
                    )

                    signupMutation.mutate({
                      data: {
                        email: formData.get('email') as string,
                        password: formData.get('password') as string,
                      },
                    })
                  }}
                  type="button"
                >
                  Sign up instead?
                </button>
              </div>
            ) : null}
          </>
        ) : null
      }
    />
  )
}
