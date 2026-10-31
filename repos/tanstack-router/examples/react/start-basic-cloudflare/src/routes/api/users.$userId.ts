import { createFileRoute } from '@tanstack/react-router'
import type { User } from '~/utils/users'

export const Route = createFileRoute('/api/users/$userId')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        console.info(`Fetching users by id=${params.userId}... @`, request.url)
        try {
          const res = await fetch(
            'https://jsonplaceholder.typicode.com/users/' + params.userId,
          )
          if (!res.ok) {
            throw new Error('Failed to fetch user')
          }

          const user = (await res.json()) as User

          return Response.json({
            id: user.id,
            name: user.name,
            email: user.email,
          })
        } catch (e) {
          console.error(e)
          return Response.json({ error: 'User not found' }, { status: 404 })
        }
      },
    },
  },
})
