import axios from 'redaxios'

export class NotFoundError extends Error {}

let queryURL = 'https://jsonplaceholder.typicode.com'

if (import.meta.env.VITE_NODE_ENV === 'test') {
  queryURL = `http://localhost:${import.meta.env.VITE_EXTERNAL_PORT}`
}

export const fetchPosts = async () => {
  console.info('Fetching posts...')
  return axios.get(`${queryURL}/posts`).then((r) => r.data.slice(0, 10))
}

export const fetchPost = async (postId) => {
  console.info(`Fetching post with id ${postId}...`)
  const post = await axios
    .get(`${queryURL}/posts/${postId}`)
    .then((r) => r.data)

  if (!post) {
    throw new NotFoundError(`Post with id "${postId}" not found!`)
  }

  return post
}
