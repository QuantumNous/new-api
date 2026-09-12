import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  ErrorComponent,
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import axios from 'redaxios'
import { z } from 'zod'
import type {
  ErrorComponentProps,
  SearchSchemaInput,
} from '@tanstack/react-router'
import './styles.css'

type PostType = {
  id: number
  title: string
  body: string
}

const fetchPosts = async () => {
  console.info('Fetching posts...')
  await new Promise((r) => setTimeout(r, 300))
  return axios
    .get<Array<PostType>>('https://jsonplaceholder.typicode.com/posts')
    .then((r) => r.data.slice(0, 10))
}

const fetchPost = async (postId: number) => {
  console.info(`Fetching post with id ${postId}...`)
  await new Promise((r) => setTimeout(r, 300))
  const post = await axios
    .get<PostType>(`https://jsonplaceholder.typicode.com/posts/${postId}`)
    .catch((err) => {
      if (err.status === 404) {
        throw new NotFoundError(`Post with id "${postId}" not found!`)
      }
      throw err
    })
    .then((r) => r.data)

  return post
}

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => {
    return <p>This is the notFoundComponent configured on root route</p>
  },
})

function RootComponent() {
  return (
    <div className="bg-linear-to-r from-green-700 to-lime-600 text-white">
      <div className="p-2 flex gap-2 text-lg bg-black/40 shadow-xl">
        <Link
          to="/"
          activeProps={{
            className: 'font-bold',
          }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>{' '}
        <Link
          to="/posts"
          activeProps={{
            className: 'font-bold',
          }}
        >
          Posts
        </Link>{' '}
        <Link
          // @ts-expect-error
          to="/this-route-does-not-exist"
          activeProps={{
            className: 'font-bold',
          }}
        >
          This Route Does Not Exist
        </Link>
      </div>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  )
}
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <div className="p-2">
      <h3>Welcome Home!</h3>
    </div>
  )
}

const postsLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'posts',
  loader: () => fetchPosts(),
  component: PostsLayoutComponent,
})

function PostsLayoutComponent() {
  const posts = postsLayoutRoute.useLoaderData()

  return (
    <div className="p-2 flex gap-2">
      <div className="list-disc bg-gray-800/70 rounded-lg divide-y divide-green-500/30">
        {posts.map((post, index) => {
          return (
            <div key={post.id} className="whitespace-nowrap">
              <Link
                to={postRoute.to}
                search={{
                  postId: post.id,
                  color: index % 2 ? 'red' : undefined,
                }}
                className="block py-1 px-2 text-green-300 hover:text-green-200"
                activeProps={{ className: 'text-white! font-bold' }}
              >
                <div>{post.title.substring(0, 20)}</div>
              </Link>
            </div>
          )
        })}
      </div>
      <Outlet />
    </div>
  )
}

const postsIndexRoute = createRoute({
  getParentRoute: () => postsLayoutRoute,
  path: '/',
  component: PostsIndexComponent,
})

function PostsIndexComponent() {
  return <div>Select a post.</div>
}

class NotFoundError extends Error {}

const postRoute = createRoute({
  getParentRoute: () => postsLayoutRoute,
  path: 'post',
  validateSearch: (
    input: {
      postId: number
      color?: 'white' | 'red' | 'green'
    } & SearchSchemaInput,
  ) =>
    z
      .object({
        postId: z.number().catch(1),
        color: z.enum(['white', 'red', 'green']).catch('white'),
      })
      .parse(input),
  loaderDeps: ({ search: { postId } }) => ({
    postId,
  }),
  errorComponent: PostErrorComponent,
  loader: ({ deps: { postId } }) => fetchPost(postId),
  component: PostComponent,
})

function PostErrorComponent({ error }: ErrorComponentProps) {
  if (error instanceof NotFoundError) {
    return <div>{error.message}</div>
  }

  return <ErrorComponent error={error} />
}

function PostComponent() {
  const post = postRoute.useLoaderData()
  const { color } = postRoute.useSearch()
  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold">{post.title}</h4>
      <hr className="opacity-20" />
      <div className={`text-sm  text-${color}-300`}>{post.body}</div>
    </div>
  )
}

const routeTree = rootRoute.addChildren([
  postsLayoutRoute.addChildren([postRoute, postsIndexRoute]),
  indexRoute,
])

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultStaleTime: 5000,
  scrollRestoration: true,
})

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)

  root.render(<RouterProvider router={router} />)
}
