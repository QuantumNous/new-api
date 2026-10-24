import { queryOptions } from '@tanstack/vue-query'
import axios from 'redaxios'

export type PostType = {
  id: string
  title: string
  body: string
}

let queryURL = 'https://jsonplaceholder.typicode.com'

if (import.meta.env.VITE_NODE_ENV === 'test') {
  queryURL = `http://localhost:${import.meta.env.VITE_EXTERNAL_PORT}`
}

export const postsQueryOptions = () =>
  queryOptions({
    queryKey: ['posts'],
    queryFn: async () => {
      console.info('Fetching posts...')
      await new Promise((r) => setTimeout(r, 500))
      return axios
        .get<Array<PostType>>(`${queryURL}/posts`)
        .then((r) => r.data.slice(0, 10))
    },
  })

export const postQueryOptions = (postId: string) =>
  queryOptions({
    queryKey: ['posts', postId],
    queryFn: async () => {
      console.info(`Fetching post with id ${postId}...`)
      await new Promise((r) => setTimeout(r, 500))

      return axios
        .get<PostType>(`${queryURL}/posts/${postId}`)
        .then((r) => r.data)
    },
  })
