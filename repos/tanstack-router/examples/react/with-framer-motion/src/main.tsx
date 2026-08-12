import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ErrorComponent,
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useMatch,
  useMatches,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import axios from 'redaxios'
import './styles.css'

type PostType = {
  id: string
  title: string
  body: string
}

const fetchPosts = async () => {
  console.info('Fetching posts...')
  await new Promise((r) => setTimeout(r, 500))
  return axios
    .get<Array<PostType>>('https://jsonplaceholder.typicode.com/posts')
    .then((r) => r.data.slice(0, 10))
}

const fetchPost = async (postId: string) => {
  console.info(`Fetching post with id ${postId}...`)
  await new Promise((r) => setTimeout(r, 500))
  const post = await axios
    .get<PostType>(`https://jsonplaceholder.typicode.com/posts/${postId}`)
    .then((r) => r.data)

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!post) {
    throw new NotFoundError(`Post with id "${postId}" not found!`)
  }

  return post
}

export const mainTransitionProps = {
  initial: { y: -20, opacity: 0, position: 'absolute' },
  animate: { y: 0, opacity: 1, damping: 5 },
  exit: { y: 60, opacity: 0 },
  transition: {
    type: 'spring',
    stiffness: 150,
    damping: 10,
  },
} as const

export const postTransitionProps = {
  initial: { y: -20, opacity: 0 },
  animate: { y: 0, opacity: 1, damping: 5 },
  exit: { y: 60, opacity: 0 },
  transition: {
    type: 'spring',
    stiffness: 150,
    damping: 10,
  },
} as const

const rootRoute = createRootRoute({
  component: () => {
    const matches = useMatches()
    const match = useMatch({ strict: false })
    const nextMatchIndex = matches.findIndex((d) => d.id === match.id) + 1
    const nextMatch = matches[nextMatchIndex]

    return (
      <>
        <div className="p-2 flex gap-2 text-lg">
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
          </Link>
        </div>
        <hr />
        <AnimatePresence mode="wait">
          <Outlet key={nextMatch.id} />
        </AnimatePresence>
        {/* Start rendering router matches */}
        <TanStackRouterDevtools position="bottom-right" />
      </>
    )
  },
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => {
    return (
      <motion.div className="p-2" {...mainTransitionProps}>
        <h3>Welcome Home!</h3>
      </motion.div>
    )
  },
})

const postsLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'posts',
  loader: () => fetchPosts(),
  component: () => {
    const posts = postsLayoutRoute.useLoaderData()
    return (
      <motion.div className="p-2 flex gap-2" {...mainTransitionProps}>
        <ul className="list-disc pl-4">
          {[...posts, { id: 'i-do-not-exist', title: 'Non-existent Post' }].map(
            (post) => {
              return (
                <li key={post.id} className="whitespace-nowrap">
                  <Link
                    to={postRoute.to}
                    params={{
                      postId: post.id,
                    }}
                    className="block py-1 text-blue-800 hover:text-blue-600"
                    activeProps={{ className: 'text-black font-bold' }}
                  >
                    <div>{post.title.substring(0, 20)}</div>
                  </Link>
                </li>
              )
            },
          )}
        </ul>
        <hr />
        <AnimatePresence>
          <Outlet />
        </AnimatePresence>
      </motion.div>
    )
  },
})

const postsIndexRoute = createRoute({
  getParentRoute: () => postsLayoutRoute,
  path: '/',
  component: () => <div>Select a post.</div>,
})

class NotFoundError extends Error {}

const postRoute = createRoute({
  getParentRoute: () => postsLayoutRoute,
  path: '$postId',
  loader: ({ params: { postId } }) => fetchPost(postId),
  errorComponent: ErrorComponent,
  component: () => {
    const post = postRoute.useLoaderData()
    return (
      <motion.div className="space-y-2" {...postTransitionProps}>
        <h4 className="text-xl font-bold underline">{post.title}</h4>
        <div className="text-sm">{post.body}</div>
      </motion.div>
    )
  },
})

const routeTree = rootRoute.addChildren([
  postsLayoutRoute.addChildren([postRoute, postsIndexRoute]),
  indexRoute,
])

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  context: {
    // loaderClient,
  },
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

  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>,
  )
}
