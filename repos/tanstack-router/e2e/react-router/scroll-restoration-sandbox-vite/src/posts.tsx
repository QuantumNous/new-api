import axios from 'redaxios'

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export type PostType = {
  id: string
  title: string
  body: string
}

let queryURL = 'https://jsonplaceholder.typicode.com'

if (import.meta.env.VITE_NODE_ENV === 'test') {
  queryURL = `http://localhost:${import.meta.env.VITE_EXTERNAL_PORT}`
}

export class PostNotFoundError extends Error {}

export const fetchPost = async (postId: string) => {
  console.info(`Fetching post with id ${postId}...`)
  const post = await axios
    .get<PostType>(`${queryURL}/posts/${postId}`)
    .then((r) => r.data)
    .catch((err) => {
      if (err.status === 404) {
        throw new PostNotFoundError(`Post with id "${postId}" not found!`)
      }
      throw err
    })

  return post
}

export const fetchPosts = async () => {
  console.info('Fetching posts...')
  return axios
    .get<Array<PostType>>(`${queryURL}/posts`)
    .then((r) => r.data.slice(0, 10))
}
