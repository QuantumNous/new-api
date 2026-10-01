import { useQuery } from '@tanstack/vue-query'
import { ErrorComponent, createFileRoute } from '@tanstack/vue-router'
import type { ErrorComponentProps } from '@tanstack/vue-router'

import { NotFound } from '~/components/NotFound'
import { userQueryOptions } from '~/utils/users'

function UserComponent() {
  const params = Route.useParams()
  const userQuery = useQuery(() => userQueryOptions(params.value.userId))

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">
        {userQuery.data.value?.name ?? 'loading...'}
      </h4>
      <div class="text-sm">{userQuery.data.value?.email ?? ''}</div>
    </div>
  )
}

export const Route = createFileRoute('/users/$userId')({
  loader: async ({ context, params: { userId } }) => {
    await context.queryClient.ensureQueryData(userQueryOptions(userId))
  },
  errorComponent: UserErrorComponent,
  component: UserComponent,
  notFoundComponent: () => {
    return <NotFound>User not found</NotFound>
  },
})

function UserErrorComponent(props: ErrorComponentProps) {
  return <ErrorComponent error={props.error} />
}
