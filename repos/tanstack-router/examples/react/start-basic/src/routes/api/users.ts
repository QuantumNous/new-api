import { createFileRoute } from '@tanstack/react-router'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { createMiddleware } from '@tanstack/react-start'
import type { User } from '~/utils/users'

const userLoggerMiddleware = createMiddleware().server(async ({ next }) => {
  console.info('In: /users')
  console.info('Request Headers:', getRequestHeaders())
  const result = await next()
  result.response.headers.set('x-users', 'true')
  console.info('Out: /users')
  return result
})

const testParentMiddleware = createMiddleware().server(async ({ next }) => {
  console.info('In: testParentMiddleware')
  const result = await next()
  result.response.headers.set('x-test-parent', 'true')
  console.info('Out: testParentMiddleware')
  return result
})

const testMiddleware = createMiddleware()
  .middleware([testParentMiddleware])
  .server(async ({ next }) => {
    console.info('In: testMiddleware')
    const result = await next()
    result.response.headers.set('x-test', 'true')

    // if (Math.random() > 0.5) {
    //   throw new Response(null, {
    //     status: 302,
    //     headers: { Location: 'https://www.google.com' },
    //   })
    // }

    console.info('Out: testMiddleware')
    return result
  })

export const Route = createFileRoute('/api/users')({
  server: {
    middleware: [testMiddleware, userLoggerMiddleware],
    handlers: {
      GET: async ({ request }) => {
        console.info('GET /api/users @', request.url)
        console.info('Fetching users... @', request.url)
        const res = await fetch('https://jsonplaceholder.typicode.com/users')
        if (!res.ok) {
          throw new Error('Failed to fetch users')
        }

        const data = (await res.json()) as Array<User>

        const list = data.slice(0, 10)

        return Response.json(
          list.map((u) => ({ id: u.id, name: u.name, email: u.email })),
        )
      },
    },
  },
})
