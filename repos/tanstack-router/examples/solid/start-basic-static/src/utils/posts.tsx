import { createServerFn } from '@tanstack/solid-start'
import axios from 'redaxios'
import { notFound } from '@tanstack/solid-router'
import { logMiddleware } from './loggingMiddleware'
import { staticFunctionMiddleware } from '@tanstack/start-static-server-functions'

export type PostType = {
  id: string
  title: string
  body: string
}

export const fetchPost = createServerFn({ method: 'GET' })
  .middleware([logMiddleware, staticFunctionMiddleware])
  .validator((d: string) => d)
  .handler(async ({ data }) => {
    console.info(`Fetching post with id ${data}...`)
    const post = await axios
      .get<PostType>(`https://jsonplaceholder.typicode.com/posts/${data}`)
      .catch((err) => {
        if (err.status === 404) {
          throw notFound()
        }
        throw err
      })
      .then((r) => r.data)

    return post
  })

export const fetchPosts = createServerFn({ method: 'GET' })
  .middleware([logMiddleware, staticFunctionMiddleware])
  .handler(async () => {
    console.info('Fetching posts...')
    return axios
      .get<Array<PostType>>('https://jsonplaceholder.typicode.com/posts')
      .then((r) => r.data.slice(0, 10))
  })
