import React from 'react'
import ReactDOM from 'react-dom/client'
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
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import axios from 'redaxios'
import type { ErrorComponentProps } from '@tanstack/react-router'
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
      className={`inline-block animate-spin px-3 transition ${
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
    <div className="p-2">
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
    <div className="p-2 flex gap-2">
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
                  className="flex py-1 text-blue-600 hover:opacity-75 gap-2 items-center"
                  activeProps={{ className: 'font-bold underline' }}
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
  const { post, commentsPromise } = postRoute.useLoaderData()

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
      <React.Suspense
        fallback={
          <div className="flex items-center gap-2">
            <Spinner />
            Loading comments...
          </div>
        }
        key={post.id}
      >
        <Await promise={commentsPromise}>
          {(comments) => {
            return (
              <div className="space-y-2">
                <h5 className="text-lg font-bold underline">Comments</h5>
                {comments.map((comment) => {
                  return (
                    <div key={comment.id}>
                      <h6 className="text-md font-bold">{comment.name}</h6>
                      <div className="text-sm italic opacity-50">
                        {comment.email}
                      </div>
                      <div className="text-sm">{comment.body}</div>
                    </div>
                  )
                })}
              </div>
            )
          }}
        </Await>
      </React.Suspense>
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
