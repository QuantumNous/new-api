import { createFileRoute } from '@tanstack/solid-router'
import * as Solid from 'solid-js'

import { z } from 'zod'
import { fetchUserById } from '../utils/mockTodos'

export const Route = createFileRoute('/dashboard/users/user')({
  validateSearch: z.object({
    userId: z.number(),
  }),
  loaderDeps: ({ search: { userId } }) => ({ userId }),
  loader: async ({ deps: { userId } }) => {
    const user = await fetchUserById(userId)
    return {
      user,
      crumb: user?.name,
    }
  },
  component: UserComponent,
})

function UserComponent() {
  const data = Route.useLoaderData()

  return (
    <>
      <h4 class="p-2 font-bold">{data()?.user?.name}</h4>
      <pre class="text-sm whitespace-pre-wrap">
        {JSON.stringify(data()?.user, null, 2)}
      </pre>
    </>
  )
}
