import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

export type PostType = {
  id: number
  title: string
  body: string
}

export const fetchPost = createServerFn({ method: 'POST' })
  .validator((d: string) => d)
  .handler(async ({ data }) => {
    console.info(`Fetching post with id ${data}...`)
    const res = await fetch(
      `https://jsonplaceholder.typicode.com/posts/${data}`,
    )
    if (!res.ok) {
      if (res.status === 404) {
        throw notFound()
      }

      throw new Error('Failed to fetch post')
    }

    const post = await res.json()

    return post as PostType
  })

export const fetchPosts = createServerFn().handler(async () => {
  console.info('Fetching posts...')
  const res = await fetch('https://jsonplaceholder.typicode.com/posts')
  if (!res.ok) {
    throw new Error('Failed to fetch posts')
  }

  const posts = await res.json()

  return (posts as Array<PostType>).slice(0, 10)
})
