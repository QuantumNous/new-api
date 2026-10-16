import { render } from 'solid-js/web'
import { Motion, Presence } from 'solid-motionone'
import {
  ErrorComponent,
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
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
  initial: { y: -20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 60, opacity: 0 },
  transition: {
    duration: 0.3,
    easing: 'ease-out',
  },
} as const

export const postTransitionProps = {
  initial: { y: -20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 60, opacity: 0 },
  transition: {
    duration: 0.3,
    easing: 'ease-out',
  },
} as const

const rootRoute = createRootRoute({
  component: () => {
    return (
      <>
        <div class="p-2 flex gap-2 text-lg">
          <Link
            to="/"
            activeProps={{
              class: 'font-bold',
            }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>{' '}
          <Link
            to="/posts"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Posts
          </Link>
        </div>
        <hr />
        <Outlet />
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
      <Motion.div class="p-2" {...mainTransitionProps}>
        <h3>Welcome Home!</h3>
      </Motion.div>
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
      <Motion.div class="p-2 flex gap-2" {...mainTransitionProps}>
        <ul class="list-disc pl-4">
          {[
            ...posts(),
            { id: 'i-do-not-exist', title: 'Non-existent Post' },
          ].map((post) => {
            return (
              <li class="whitespace-nowrap">
                <Link
                  to={postRoute.to}
                  params={{
                    postId: post.id,
                  }}
                  class="block py-1 text-blue-800 hover:text-blue-600"
                  activeProps={{ class: 'text-black font-bold' }}
                >
                  <div>{post.title.substring(0, 20)}</div>
                </Link>
              </li>
            )
          })}
        </ul>
        <hr />
        <Presence>
          <Outlet />
        </Presence>
      </Motion.div>
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
      <Motion.div class="space-y-2" {...postTransitionProps}>
        <h4 class="text-xl font-bold underline">{post().title}</h4>
        <div class="text-sm">{post().body}</div>
      </Motion.div>
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
declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  render(() => <RouterProvider router={router} />, rootElement)
}
