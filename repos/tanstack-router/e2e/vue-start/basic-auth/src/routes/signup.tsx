import { createFileRoute, redirect } from '@tanstack/vue-router'
import { createServerFn, useServerFn } from '@tanstack/vue-start'
import { defineComponent } from 'vue'

import { hashPassword, prismaClient } from '~/utils/prisma'
import { useMutation } from '~/hooks/useMutation'
import { Auth } from '~/components/Auth'
import { useAppSession } from '~/utils/session'

export const signupFn = createServerFn({
  method: 'POST',
})
  .validator(
    (data: { email: string; password: string; redirectUrl?: string }) => data,
  )
  .handler(async ({ data: payload }) => {
    // Check if the user already exists
    const found = await prismaClient.user.findUnique({
      where: {
        email: payload.email,
      },
    })

    // Encrypt the password using Sha256 into plaintext
    const password = await hashPassword(payload.password)

    // Create a session
    const session = await useAppSession()

    if (found) {
      if (found.password !== password) {
        return {
          error: true,
          userExists: true,
          message: 'User already exists',
        }
      }

      // Store the user's email in the session
      await session.update({
        userEmail: found.email,
      })

      // Redirect to the prev page stored in the "redirect" search param
      throw redirect({
        href: payload.redirectUrl || '/',
      })
    }

    // Create the user
    const user = await prismaClient.user.create({
      data: {
        email: payload.email,
        password,
      },
    })

    // Store the user's email in the session
    await session.update({
      userEmail: user.email,
    })

    // Redirect to the prev page stored in the "redirect" search param
    throw redirect({
      href: payload.redirectUrl || '/',
    })
  })

const SignupComp = defineComponent({
  name: 'Signup',
  setup() {
    const signup = useServerFn(signupFn)

    const signupMutation = useMutation({
      fn: signup,
    })

    return () => (
      <Auth
        actionText="Sign Up"
        status={signupMutation.status.value}
        onSubmit={(form) => {
          const formData = new FormData(form)

          signupMutation.mutate({
            data: {
              email: formData.get('email') as string,
              password: formData.get('password') as string,
            },
          })
        }}
        afterSubmit={
          signupMutation.data.value?.error ? (
            <>
              <div class="text-red-400">
                {signupMutation.data.value?.message}
              </div>
            </>
          ) : null
        }
      />
    )
  },
})

export const Route = createFileRoute('/signup')({
  component: SignupComp,
})
