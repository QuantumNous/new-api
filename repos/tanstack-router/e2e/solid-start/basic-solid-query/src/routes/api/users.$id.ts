import { createFileRoute } from '@tanstack/solid-router'
import axios from 'redaxios'
import type { User } from '../../utils/users'

let queryURL = 'https://jsonplaceholder.typicode.com'

if (import.meta.env.VITE_NODE_ENV === 'test') {
  queryURL = `http://localhost:${import.meta.env.VITE_EXTERNAL_PORT}`
}

export const Route = createFileRoute('/api/users/$id')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        console.info(`Fetching users by id=${params.id}... @`, request.url)
        try {
          const res = await axios.get<User>(`${queryURL}/users/` + params.id)
          return Response.json({
            id: res.data.id,
            name: res.data.name,
            email: res.data.email,
          })
        } catch (e) {
          console.error(e)
          return Response.json({ error: 'User not found' }, { status: 404 })
        }
      },
    },
  },
})
