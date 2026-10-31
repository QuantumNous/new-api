import { render } from 'solid-js/web'
import { Suspense } from 'solid-js'
import {
  Await,
  ErrorComponent,
  Link,
  MatchRoute,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  defer,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import axios from 'redaxios'
import type { ErrorComponentProps } from '@tanstack/solid-router'
import './styles.css'

type PostType = {
  id: string
  title: string
  body: string
}

type CommentType = {
  id: string
  postId: string
  name: string
  email: string
  body: string
}

const fetchPosts = async () => {
  console.info('Fetching posts...')
  await new Promise((r) => setTimeout(r, 100))
  return axios
    .get<Array<PostType>>('https://jsonplaceholder.typicode.com/posts')
    .then((r) => r.data.slice(0, 10))
}

const fetchPost = async (postId: string) => {
  console.info(`Fetching post with id ${postId}...`)

  const commentsPromise = new Promise((r) => setTimeout(r, 2000))
    .then(() =>
      axios.get<Array<CommentType>>(
        `https://jsonplaceholder.typicode.com/comments?postId=${postId}`,
      ),
    )
    .then((r) => r.data)

  const post = await new Promise((r) => setTimeout(r, 1000))
    .then(() =>
      axios.get<PostType>(
        `https://jsonplaceholder.typicode.com/posts/${postId}`,
      ),
    )
    .catch((err) => {
      if (err.status === 404) {
        throw new NotFoundError(`Post with id "${postId}" not found!`)
      }
      throw err
    })
    .then((r) => r.data)

  return {
    post,
    commentsPromise: defer(commentsPromise),
  }
}

function Spinner({ show, wait }: { show?: boolean; wait?: `delay-${number}` }) {
  return (
    <div
      class={`inline-block animate-spin px-3 transition ${
        (show ?? true)
          ? `opacity-100 duration-500 ${wait ?? 'delay-300'}`
          : 'duration-500 opacity-0 delay-0'
      }`}
    >
      ⍥
    </div>
  )
}

const rootRoute = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
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
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
}).update({
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <div class="p-2">
      <h3>Welcome Home!</h3>
    </div>
  )
}

const postsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'posts',
  loader: fetchPosts,
  component: PostsComponent,
})

function PostsComponent() {
  const posts = postsRoute.useLoaderData()

  return (
    <div class="p-2 flex gap-2">
      <ul class="list-disc pl-4">
        {[...posts(), { id: 'i-do-not-exist', title: 'Non-existent Post' }].map(
          (post) => {
            return (
              <li class="whitespace-nowrap">
                <Link
                  to={postRoute.to}
                  params={{
                    postId: post.id,
                  }}
                  class="flex py-1 text-blue-600 hover:opacity-75 gap-2 items-center"
                  activeProps={{ class: 'font-bold underline' }}
                >
                  <div>{post.title.substring(0, 20)}</div>
                  <MatchRoute
                    to={postRoute.to}
                    params={{
                      postId: post.id,
                    }}
                    pending
                  >
                    {(match) => {
                      return <Spinner show={!!match} wait="delay-0" />
                    }}
                  </MatchRoute>
                </Link>
              </li>
            )
          },
        )}
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}

class NotFoundError extends Error {}

const postRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '$postId',
  loader: async ({ params: { postId } }) => fetchPost(postId),
  errorComponent: PostErrorComponent,
  component: PostComponent,
})

function PostErrorComponent({ error }: ErrorComponentProps) {
  if (error instanceof NotFoundError) {
    return <div>{error.message}</div>
  }

  return <ErrorComponent error={error} />
}

function PostComponent() {
  const loaderData = postRoute.useLoaderData()

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{loaderData().post.title}</h4>
      <div class="text-sm">{loaderData().post.body}</div>
      <Suspense
        fallback={
          <div class="flex items-center gap-2">
            <Spinner />
            Loading comments...
          </div>
        }
      >
        <Await promise={loaderData().commentsPromise}>
          {(comments) => {
            return (
              <div class="space-y-2">
                <h5 class="text-lg font-bold underline">Comments</h5>
                {comments.map((comment) => {
                  return (
                    <div>
                      <h6 class="text-md font-bold">{comment.name}</h6>
                      <div class="text-sm italic opacity-50">
                        {comment.email}
                      </div>
                      <div class="text-sm">{comment.body}</div>
                    </div>
                  )
                })}
              </div>
            )
          }}
        </Await>
      </Suspense>
    </div>
  )
}

const routeTree = rootRoute.addChildren([
  postsRoute.addChildren([postRoute]),
  indexRoute,
])

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
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
