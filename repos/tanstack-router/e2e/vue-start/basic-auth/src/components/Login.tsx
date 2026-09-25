import { useRouter } from '@tanstack/vue-router'
import { useServerFn } from '@tanstack/vue-start'
import { useMutation } from '../hooks/useMutation'
import { loginFn } from '../routes/_authed'
import { Auth } from './Auth'
import { signupFn } from '~/routes/signup'
import { defineComponent } from 'vue'

export const Login = defineComponent({
  name: 'Login',
  setup() {
    const router = useRouter()
    const login = useServerFn(loginFn)
    const signup = useServerFn(signupFn)

    const loginMutation = useMutation({
      fn: login,
      onSuccess: async (ctx) => {
        if (!ctx.data?.error) {
          await router.invalidate()
          router.navigate({ to: '/' })
          return
        }
      },
    })

    const signupMutation = useMutation({
      fn: signup,
    })

    return () => (
      <Auth
        actionText="Login"
        status={loginMutation.status.value}
        onSubmit={(form) => {
          const formData = new FormData(form)

          loginMutation.mutate({
            data: {
              email: formData.get('email') as string,
              password: formData.get('password') as string,
            },
          })
        }}
        afterSubmit={
          loginMutation.data.value ? (
            <>
              <div class="text-red-400">
                {loginMutation.data.value?.message}
              </div>
              {loginMutation.data.value?.userNotFound ? (
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
  },
})
