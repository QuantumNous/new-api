import React, { act } from 'react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
} from '@testing-library/react'

import { z } from 'zod'

import { trailingSlashOptions } from '@tanstack/router-core'
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouteMask,
  createRouter,
  getRouteApi,
  useNavigate,
  useParams,
} from '../src'
import type { RouterHistory } from '../src'

let history: RouterHistory

beforeEach(() => {
  history = createBrowserHistory()
  expect(window.location.pathname).toBe('/')
})

afterEach(() => {
  history.destroy()
  window.history.replaceState(null, 'root', '/')
  vi.clearAllMocks()
  vi.resetAllMocks()
  cleanup()
})

test('when navigating to /posts', async () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Index</h1>
        <button onClick={() => navigate({ to: '/' })}>Index</button>
        <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts',
    component: () => {
      return (
        <>
          <h1>Posts</h1>
        </>
      )
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    history,
  })

  render(<RouterProvider router={router} />)

  const postsButton = await screen.findByRole('button', { name: 'Posts' })

  fireEvent.click(postsButton)

  expect(
    await screen.findByRole('heading', { name: 'Posts' }),
  ).toBeInTheDocument()

  expect(window.location.pathname).toBe('/posts')
})

test('when navigating from /posts to ./$postId', async () => {
  const rootRoute = createRootRoute()
  const IndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Index</h1>
        <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
        <button
          onClick={() =>
            navigate({ to: '/posts/$postId', params: { postId: 'id1' } })
          }
        >
          To first post
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const PostsComponent = () => {
    return (
      <>
        <h1>Posts</h1>
        <Outlet />
      </>
    )
  }

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'posts',
    component: PostsComponent,
  })

  const PostsIndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Posts Index</h1>
        <button
          onClick={() =>
            navigate({
              from: '/posts/',
              to: './$postId',
              params: { postId: 'id1' },
            })
          }
        >
          To the first post
        </button>
      </>
    )
  }

  const postsIndexRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '/',
    component: PostsIndexComponent,
  })

  const PostComponent = () => {
    const params = useParams({ strict: false })
    const navigate = useNavigate()
    return (
      <>
        <span>Params: {params.postId}</span>
        <button onClick={() => navigate({ to: '/' })}>Index</button>
      </>
    )
  }

  const postRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '$postId',
    component: PostComponent,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      postsRoute.addChildren([postsIndexRoute, postRoute]),
    ]),
  })

  render(<RouterProvider router={router} />)

  const postsButton = await screen.findByRole('button', { name: 'Posts' })

  fireEvent.click(postsButton)

  expect(await screen.findByText('Posts Index')).toBeInTheDocument()

  const postButton = await screen.findByRole('button', {
    name: 'To the first post',
  })

  fireEvent.click(postButton)

  expect(await screen.findByText('Params: id1')).toBeInTheDocument()

  expect(window.location.pathname).toBe('/posts/id1')
})

test('when navigating from /posts to ../posts/$postId', async () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Index</h1>
        <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
        <button
          onClick={() =>
            navigate({ to: '/posts/$postId', params: { postId: 'id1' } })
          }
        >
          To first post
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const PostsComponent = () => {
    return (
      <>
        <h1>Posts</h1>
        <Outlet />
      </>
    )
  }

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'posts',
    component: PostsComponent,
  })

  const PostsIndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Posts Index</h1>
        <button
          onClick={() =>
            navigate({
              from: '/posts/',
              to: '../posts/$postId',
              params: { postId: 'id1' },
            })
          }
        >
          To the first post
        </button>
      </>
    )
  }

  const postsIndexRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '/',
    component: PostsIndexComponent,
  })

  const PostComponent = () => {
    const navigate = useNavigate()
    const params = useParams({ strict: false })
    return (
      <>
        <span>Params: {params.postId}</span>
        <button onClick={() => navigate({ to: '/' })}>Index</button>
      </>
    )
  }

  const postRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '$postId',
    component: PostComponent,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      postsRoute.addChildren([postsIndexRoute, postRoute]),
    ]),
    history,
  })

  render(<RouterProvider router={router} />)

  const postsButton = await screen.findByRole('button', { name: 'Posts' })

  fireEvent.click(postsButton)

  expect(await screen.findByText('Posts Index')).toBeInTheDocument()

  const postButton = await screen.findByRole('button', {
    name: 'To the first post',
  })

  fireEvent.click(postButton)

  expect(await screen.findByText('Params: id1')).toBeInTheDocument()
})

test('when navigating from /posts/$postId to /posts/$postId/info and the current route is /posts/$postId/details', async () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Index</h1>
        <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
        <button
          onClick={() =>
            navigate({
              to: '/posts/$postId/details',
              params: { postId: 'id1' },
            })
          }
        >
          To first post
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const layoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_layout',
    component: () => {
      return (
        <>
          <h1>Layout</h1>
          <Outlet />
        </>
      )
    },
  })

  const PostsComponent = () => {
    return (
      <>
        <h1>Posts</h1>
        <Outlet />
      </>
    )
  }

  const postsRoute = createRoute({
    getParentRoute: () => layoutRoute,
    path: 'posts',
    component: PostsComponent,
  })

  const PostComponent = () => {
    const params = useParams({ strict: false })
    return (
      <>
        <span>Params: {params.postId}</span>
        <Outlet />
      </>
    )
  }

  const postRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '$postId',
    component: PostComponent,
  })

  const DetailsComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Details!</h1>
        <button
          onClick={() =>
            navigate({ from: '/posts/$postId', to: '/posts/$postId/info' })
          }
        >
          To Information
        </button>
      </>
    )
  }

  const detailsRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'details',
    component: DetailsComponent,
  })

  const InformationComponent = () => {
    return (
      <>
        <h1>Information</h1>
      </>
    )
  }

  const informationRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'info',
    component: InformationComponent,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      layoutRoute.addChildren([
        postsRoute.addChildren([
          postRoute.addChildren([detailsRoute, informationRoute]),
        ]),
      ]),
    ]),
    history,
  })

  render(<RouterProvider router={router} />)

  const postsButton = await screen.findByRole('button', {
    name: 'To first post',
  })

  fireEvent.click(postsButton)

  expect(await screen.findByText('Params: id1')).toBeInTheDocument()

  expect(window.location.pathname).toEqual('/posts/id1/details')

  const informationButton = await screen.findByRole('button', {
    name: 'To Information',
  })

  fireEvent.click(informationButton)

  expect(await screen.findByText('Information')).toBeInTheDocument()

  expect(window.location.pathname).toEqual('/posts/id1/info')

  expect(await screen.findByText('Params: id1'))
})

test('when navigating from /posts/$postId to ./info and the current route is /posts/$postId/details', async () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Index</h1>
        <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
        <button
          onClick={() =>
            navigate({
              to: '/posts/$postId/details',
              params: { postId: 'id1' },
            })
          }
        >
          To first post
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const layoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_layout',
    component: () => {
      return (
        <>
          <h1>Layout</h1>
          <Outlet />
        </>
      )
    },
  })

  const PostsComponent = () => {
    return (
      <>
        <h1>Posts</h1>
        <Outlet />
      </>
    )
  }

  const postsRoute = createRoute({
    getParentRoute: () => layoutRoute,
    path: 'posts',
    component: PostsComponent,
  })

  const PostComponent = () => {
    const params = useParams({ strict: false })
    return (
      <>
        <span>Params: {params.postId}</span>
        <Outlet />
      </>
    )
  }

  const postRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '$postId',
    component: PostComponent,
  })

  const DetailsComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Details!</h1>
        <button
          onClick={() => navigate({ from: '/posts/$postId', to: './info' })}
        >
          To Information
        </button>
      </>
    )
  }

  const detailsRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'details',
    component: DetailsComponent,
  })

  const InformationComponent = () => {
    return (
      <>
        <h1>Information</h1>
      </>
    )
  }

  const informationRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'info',
    component: InformationComponent,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      layoutRoute.addChildren([
        postsRoute.addChildren([
          postRoute.addChildren([detailsRoute, informationRoute]),
        ]),
      ]),
    ]),
    history,
  })

  render(<RouterProvider router={router} />)

  const postsButton = await screen.findByRole('button', {
    name: 'To first post',
  })

  fireEvent.click(postsButton)

  expect(await screen.findByText('Params: id1')).toBeInTheDocument()

  expect(window.location.pathname).toEqual('/posts/id1/details')

  const informationButton = await screen.findByRole('button', {
    name: 'To Information',
  })

  fireEvent.click(informationButton)

  expect(await screen.findByText('Information')).toBeInTheDocument()

  expect(window.location.pathname).toEqual('/posts/id1/info')

  expect(await screen.findByText('Params: id1'))
})

test('when navigating from /posts/$postId to ../$postId and the current route is /posts/$postId/details', async () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Index</h1>
        <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
        <button
          onClick={() =>
            navigate({
              to: '/posts/$postId/details',
              params: { postId: 'id1' },
            })
          }
        >
          To first post
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const layoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_layout',
    component: () => {
      return (
        <>
          <h1>Layout</h1>
          <Outlet />
        </>
      )
    },
  })

  const PostsComponent = () => {
    return (
      <>
        <h1>Posts</h1>
        <Outlet />
      </>
    )
  }

  const postsRoute = createRoute({
    getParentRoute: () => layoutRoute,
    path: 'posts',
    component: PostsComponent,
  })

  const PostComponent = () => {
    const params = useParams({ strict: false })
    return (
      <>
        <span>Params: {params.postId}</span>
        <Outlet />
      </>
    )
  }

  const postRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '$postId',
    component: PostComponent,
  })

  const DetailsComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Details!</h1>
        <button
          onClick={() => navigate({ from: '/posts/$postId', to: '../$postId' })}
        >
          To Post
        </button>
      </>
    )
  }

  const detailsRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'details',
    component: DetailsComponent,
  })

  const InformationComponent = () => {
    return (
      <>
        <h1>Information</h1>
      </>
    )
  }

  const informationRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'info',
    component: InformationComponent,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      layoutRoute.addChildren([
        postsRoute.addChildren([
          postRoute.addChildren([detailsRoute, informationRoute]),
        ]),
      ]),
    ]),
    history,
  })

  render(<RouterProvider router={router} />)

  const postsButton = await screen.findByRole('button', {
    name: 'To first post',
  })

  fireEvent.click(postsButton)

  expect(await screen.findByText('Params: id1')).toBeInTheDocument()

  expect(window.location.pathname).toEqual('/posts/id1/details')

  const postButton = await screen.findByRole('button', {
    name: 'To Post',
  })

  fireEvent.click(postButton)

  expect(await screen.findByText('Posts')).toBeInTheDocument()

  expect(window.location.pathname).toEqual('/posts/id1')
})

test('when navigating from /posts/$postId with an index to ../$postId and the current route is /posts/$postId/details', async () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Index</h1>
        <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
        <button
          onClick={() =>
            navigate({
              to: '/posts/$postId/details',
              params: { postId: 'id1' },
            })
          }
        >
          To first post
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const layoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_layout',
    component: () => {
      return (
        <>
          <h1>Layout</h1>
          <Outlet />
        </>
      )
    },
  })

  const PostsComponent = () => {
    return (
      <>
        <h1>Posts</h1>
        <Outlet />
      </>
    )
  }

  const postsRoute = createRoute({
    getParentRoute: () => layoutRoute,
    path: 'posts',
    component: PostsComponent,
  })

  const PostComponent = () => {
    const params = useParams({ strict: false })
    return (
      <>
        <span>Params: {params.postId}</span>
        <Outlet />
      </>
    )
  }

  const postRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '$postId',
    component: PostComponent,
  })

  const postIndexRoute = createRoute({
    getParentRoute: () => postRoute,
    path: '/',
    component: () => <h1>Post Index</h1>,
  })

  const DetailsComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Details!</h1>
        <button
          onClick={() => navigate({ from: '/posts/$postId', to: '../$postId' })}
        >
          To Post
        </button>
      </>
    )
  }

  const detailsRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'details',
    component: DetailsComponent,
  })

  const InformationComponent = () => {
    return (
      <>
        <h1>Information</h1>
      </>
    )
  }

  const informationRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'info',
    component: InformationComponent,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      layoutRoute.addChildren([
        postsRoute.addChildren([
          postRoute.addChildren([
            postIndexRoute,
            detailsRoute,
            informationRoute,
          ]),
        ]),
      ]),
    ]),
    history,
  })

  render(<RouterProvider router={router} />)

  const postsButton = await screen.findByRole('button', {
    name: 'To first post',
  })

  fireEvent.click(postsButton)

  expect(await screen.findByText('Params: id1')).toBeInTheDocument()

  expect(window.location.pathname).toEqual('/posts/id1/details')

  const postButton = await screen.findByRole('button', {
    name: 'To Post',
  })

  fireEvent.click(postButton)

  expect(await screen.findByText('Posts')).toBeInTheDocument()

  expect(window.location.pathname).toEqual('/posts/id1')
})

test('when navigating from /invoices to ./invoiceId and the current route is /posts/$postId/details', async () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Index</h1>
        <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
        <button
          onClick={() =>
            navigate({
              to: '/posts/$postId/details',
              params: { postId: 'id1' },
            })
          }
        >
          To first post
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const layoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '_layout',
    component: () => {
      return (
        <>
          <h1>Layout</h1>
          <Outlet />
        </>
      )
    },
  })

  const PostsComponent = () => {
    return (
      <>
        <h1>Posts</h1>
        <Outlet />
      </>
    )
  }

  const postsRoute = createRoute({
    getParentRoute: () => layoutRoute,
    path: 'posts',
    component: PostsComponent,
  })

  const PostComponent = () => {
    const params = useParams({ strict: false })
    return (
      <>
        <span>Params: {params.postId}</span>
        <Outlet />
      </>
    )
  }

  const postRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '$postId',
    component: PostComponent,
  })

  const DetailsComponent = () => {
    const navigate = useNavigate()
    const [error, setError] = React.useState<unknown>()
    return (
      <>
        <h1>Details!</h1>
        <button
          onClick={() => {
            try {
              navigate({
                from: '/invoices',
                to: './$invoiceId',
                params: { invoiceId: 'id1' },
              })
            } catch (e) {
              setError(e)
            }
          }}
        >
          To Invoices
        </button>
        <span>Something went wrong!</span>
      </>
    )
  }

  const detailsRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'details',
    component: DetailsComponent,
  })

  const InformationComponent = () => {
    return (
      <>
        <h1>Information</h1>
      </>
    )
  }

  const informationRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'info',
    component: InformationComponent,
  })

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
    component: () => (
      <>
        <h1>Invoices!</h1>
        <Outlet />
      </>
    ),
  })

  const InvoiceComponent = () => {
    const params = useParams({ strict: false })
    return (
      <>
        <span>invoiceId: {params.invoiceId}</span>
      </>
    )
  }

  const invoiceRoute = createRoute({
    getParentRoute: () => invoicesRoute,
    path: '$invoiceId',
    component: InvoiceComponent,
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      indexRoute,
      layoutRoute.addChildren([
        invoicesRoute.addChildren([invoiceRoute]),
        postsRoute.addChildren([
          postRoute.addChildren([detailsRoute, informationRoute]),
        ]),
      ]),
    ]),
    history,
  })

  const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

  render(<RouterProvider router={router} />)

  const postsButton = await screen.findByRole('button', {
    name: 'To first post',
  })

  fireEvent.click(postsButton)

  const invoicesButton = await screen.findByRole('button', {
    name: 'To Invoices',
  })

  fireEvent.click(invoicesButton)

  expect(consoleWarn).toHaveBeenCalledWith(
    'Could not find match for from: /invoices',
  )

  consoleWarn.mockRestore()
})

test('when navigating to /posts/$postId/info which is masked as /posts/$postId', async () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Index</h1>
        <button
          onClick={() =>
            navigate({ to: '/posts/$postId/info', params: { postId: 'id1' } })
          }
        >
          To first post
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const PostsComponent = () => {
    return (
      <>
        <h1>Posts</h1>
        <Outlet />
      </>
    )
  }

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'posts',
    component: PostsComponent,
  })

  const PostComponent = () => {
    const params = useParams({ strict: false })
    return (
      <>
        <span>Params: {params.postId}</span>
        <Outlet />
      </>
    )
  }

  const postRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '$postId',
    component: PostComponent,
  })

  const InformationComponent = () => {
    return (
      <>
        <h1>Information</h1>
      </>
    )
  }

  const informationRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'info',
    component: InformationComponent,
  })

  const routeTree = rootRoute.addChildren([
    indexRoute,
    postsRoute.addChildren([postRoute.addChildren([informationRoute])]),
  ])

  const routeMask = createRouteMask({
    routeTree,
    from: '/posts/$postId/info',
    to: '/posts',
  })

  const router = createRouter({
    routeTree,
    routeMasks: [routeMask],
    history,
  })

  render(<RouterProvider router={router} />)

  const postButton = await screen.findByRole('button', {
    name: 'To first post',
  })

  fireEvent.click(postButton)

  expect(await screen.findByText('Params: id1'))
})

test('when navigating to /posts/$postId/info which is imperatively masked as /posts/$postId', async () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Index</h1>
        <button
          onClick={() =>
            navigate({
              to: '/posts/$postId/info',
              params: { postId: 'id1' },
              mask: { to: '/posts/$postId', params: { postId: 'id1' } },
            })
          }
        >
          To first post
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const PostsComponent = () => {
    return (
      <>
        <h1>Posts</h1>
        <Outlet />
      </>
    )
  }

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'posts',
    component: PostsComponent,
  })

  const PostComponent = () => {
    const params = useParams({ strict: false })
    return (
      <>
        <span>Params: {params.postId}</span>
        <Outlet />
      </>
    )
  }

  const postRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '$postId',
    component: PostComponent,
  })

  const InformationComponent = () => {
    return (
      <>
        <h1>Information</h1>
      </>
    )
  }

  const informationRoute = createRoute({
    getParentRoute: () => postRoute,
    path: 'info',
    component: InformationComponent,
  })

  const routeTree = rootRoute.addChildren([
    indexRoute,
    postsRoute.addChildren([postRoute.addChildren([informationRoute])]),
  ])

  const router = createRouter({
    routeTree,
    history,
  })

  render(<RouterProvider router={router} />)

  const postButton = await screen.findByRole('button', {
    name: 'To first post',
  })

  fireEvent.click(postButton)

  expect(await screen.findByText('Information')).toBeInTheDocument()

  expect(window.location.pathname).toEqual('/posts/id1')
})

test('when setting search params with 2 parallel navigate calls', async () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()
    const search = indexRoute.useSearch()
    return (
      <>
        <h1>Index</h1>
        <div data-testid="param1">{search.param1}</div>
        <div data-testid="param2">{search.param2}</div>
        <button
          onClick={() => {
            navigate({
              to: '/',
              search: (prev: any) => ({ ...prev, param1: 'foo' }),
            })

            navigate({
              to: '/',
              search: (prev: any) => ({ ...prev, param2: 'bar' }),
            })
          }}
        >
          search
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
    validateSearch: z.object({
      param1: z.string().default('param1-default'),
      param2: z.string().default('param2-default'),
    }),
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history,
  })

  render(<RouterProvider router={router} />)
  expect(router.state.location.search).toEqual({
    param1: 'param1-default',
    param2: 'param2-default',
  })

  const postsButton = await screen.findByRole('button', { name: 'search' })

  fireEvent.click(postsButton)

  expect(await screen.findByTestId('param1')).toHaveTextContent('foo')
  expect(await screen.findByTestId('param2')).toHaveTextContent('bar')
  expect(router.state.location.search).toEqual({ param1: 'foo', param2: 'bar' })
  const search = new URLSearchParams(window.location.search)
  expect(search.get('param1')).toEqual('foo')
  expect(search.get('param2')).toEqual('bar')
})

test('<Navigate> navigates only once in <StrictMode>', async () => {
  configure({ reactStrictMode: true })
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <Navigate to="/posts" />,
  })

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts',
    component: () => {
      return (
        <>
          <h1 data-testid="posts-title">Posts</h1>
        </>
      )
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    history,
  })

  const navigateSpy = vi.spyOn(router, 'navigate')

  render(<RouterProvider router={router} />)

  expect(await screen.findByTestId('posts-title')).toBeInTheDocument()
  expect(navigateSpy.mock.calls.length).toBe(1)
})

test.each([true, false])(
  'should navigate to current route with search params when using "." in nested route structure from Index Route',
  async (trailingSlash: boolean) => {
    const tail = trailingSlash ? '/' : ''

    const rootRoute = createRootRoute()

    const IndexComponent = () => {
      const navigate = useNavigate()
      return (
        <>
          <button
            data-testid="posts-btn"
            onClick={() => {
              navigate({
                to: '/post',
              })
            }}
          >
            Post
          </button>
          <button
            data-testid="search-btn"
            onClick={() =>
              navigate({
                to: '.',
                search: {
                  param1: 'value1',
                },
              })
            }
          >
            Search
          </button>
          <button
            data-testid="search2-btn"
            onClick={() =>
              navigate({
                to: '/post',
                search: {
                  param1: 'value2',
                },
              })
            }
          >
            Search2
          </button>
          <Outlet />
        </>
      )
    }

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: IndexComponent,
      validateSearch: z.object({
        param1: z.string().optional(),
      }),
    })

    const postRoute = createRoute({
      getParentRoute: () => indexRoute,
      path: 'post',
      component: () => <div>Post</div>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postRoute]),
      history,
      trailingSlash: trailingSlash ? 'always' : 'never',
    })

    render(<RouterProvider router={router} />)

    const postButton = await screen.findByTestId('posts-btn')

    fireEvent.click(postButton)

    expect(router.state.location.pathname).toBe(`/post${tail}`)

    const searchButton = await screen.findByTestId('search-btn')

    fireEvent.click(searchButton)

    expect(router.state.location.pathname).toBe(`/post${tail}`)
    expect(router.state.location.search).toEqual({ param1: 'value1' })

    const searchButton2 = await screen.findByTestId('search2-btn')

    fireEvent.click(searchButton2)

    expect(router.state.location.pathname).toBe(`/post${tail}`)
    expect(router.state.location.search).toEqual({ param1: 'value2' })
  },
)

test.each([true, false])(
  'should navigate to current route with changing path params when using "." in nested route structure',
  async (trailingSlash) => {
    const tail = trailingSlash ? '/' : ''
    const rootRoute = createRootRoute()

    const IndexComponent = () => {
      const navigate = useNavigate()
      return (
        <>
          <h1 data-testid="index-heading">Index</h1>
          <button
            data-testid="posts-btn"
            onClick={() => navigate({ to: '/posts' })}
          >
            Posts
          </button>
        </>
      )
    }

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: IndexComponent,
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      const navigate = useNavigate()

      return (
        <>
          <h1 data-testid="posts-index-heading">Posts</h1>
          <button
            data-testid="first-post-btn"
            onClick={() =>
              navigate({
                to: '$postId',
                params: { postId: 'id1' },
              })
            }
          >
            To first post
          </button>
          <button
            data-testid="second-post-btn"
            onClick={() =>
              navigate({
                to: '.',
                params: { postId: 'id2' },
              })
            }
          >
            To second post
          </button>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span data-testid={`post-${params.postId}`}>
            Params: {params.postId}
          </span>
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([postsRoute.addChildren([postRoute])]),
      ]),
      trailingSlash: trailingSlash ? 'always' : 'never',
    })

    render(<RouterProvider router={router} />)

    const postsButton = await screen.findByTestId('posts-btn')

    fireEvent.click(postsButton)

    expect(await screen.findByTestId('posts-index-heading')).toBeInTheDocument()
    expect(window.location.pathname).toEqual(`/posts${tail}`)

    const firstPostButton = await screen.findByTestId('first-post-btn')

    fireEvent.click(firstPostButton)

    expect(await screen.findByTestId('post-id1')).toBeInTheDocument()
    expect(window.location.pathname).toEqual(`/posts/id1${tail}`)

    const secondPostButton = await screen.findByTestId('second-post-btn')

    fireEvent.click(secondPostButton)

    expect(await screen.findByTestId('post-id2')).toBeInTheDocument()
    expect(window.location.pathname).toEqual(`/posts/id2${tail}`)
  },
)

test.each([true, false])(
  'should navigate to current route with search params when using "." in nested route structure from non-Index Route',
  async (trailingSlash) => {
    const tail = trailingSlash ? '/' : ''
    const rootRoute = createRootRoute()

    const IndexComponent = () => {
      const navigate = useNavigate()
      return (
        <>
          <h1 data-testid="index-heading">Index</h1>
          <button
            data-testid="posts-btn"
            onClick={() => navigate({ to: '/posts', params: { lang: '1' } })}
          >
            Posts
          </button>
        </>
      )
    }

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: IndexComponent,
    })

    const PostsComponent = () => {
      const navigate = useNavigate()
      return (
        <>
          <h1 data-testid="posts-index-heading">Posts</h1>
          <button
            data-testid="first-post-btn"
            onClick={() =>
              navigate({
                to: '$postId/detail',
                params: { postId: 'id1' },
              })
            }
          >
            To first post
          </button>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const useModal = (name: string) => {
      const currentOpen = postRoute.useSearch({
        select: (search) => search[`_${name}`],
      })

      const navigate = useNavigate()

      const setModal = React.useCallback(
        (open: boolean) => {
          navigate({
            to: '.',
            search: (prev: {}) => ({
              ...prev,
              [`_${name}`]: open ? true : undefined,
            }),
            resetScroll: false,
          })
        },
        [name, navigate],
      )

      return [currentOpen, setModal] as const
    }

    function DetailComponent(props: { id: string }) {
      const params = useParams({ strict: false })
      const [currentTest, setTest] = useModal('test')

      return (
        <>
          <div data-testid={`detail-heading-${props.id}`}>
            Post Path "/{params.postId}/detail-{props.id}"!
          </div>
          {currentTest ? (
            <button
              data-testid={`detail-btn-remove-${props.id}`}
              onClick={() => setTest(false)}
            >
              Remove test
            </button>
          ) : (
            <button
              data-testid={`detail-btn-add-${props.id}`}
              onClick={() => setTest(true)}
            >
              Add test
            </button>
          )}
        </>
      )
    }

    const PostComponent = () => {
      const params = useParams({ strict: false })

      return (
        <div>
          <div data-testid="post-heading">Post "{params.postId}"!</div>
          <DetailComponent id={'1'} />
          <Outlet />
        </div>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
      validateSearch: z.object({
        _test: z.boolean().optional(),
      }),
    })

    const detailRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'detail',
      component: () => <DetailComponent id={'2'} />,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        postsRoute.addChildren([postRoute.addChildren([detailRoute])]),
      ]),
      trailingSlash: trailingSlash ? 'always' : 'never',
    })

    render(<RouterProvider router={router} />)

    const postsButton = await screen.findByTestId('posts-btn')

    fireEvent.click(postsButton)

    expect(await screen.findByTestId('posts-index-heading')).toBeInTheDocument()

    const post1Button = await screen.findByTestId('first-post-btn')

    fireEvent.click(post1Button)
    expect(await screen.findByTestId('post-heading')).toBeInTheDocument()
    expect(await screen.findByTestId('detail-heading-1')).toBeInTheDocument()
    expect(await screen.findByTestId('detail-heading-2')).toBeInTheDocument()
    expect(await screen.findByTestId('detail-heading-1')).toHaveTextContent(
      'Post Path "/id1/detail-1',
    )
    expect(await screen.findByTestId('detail-heading-2')).toHaveTextContent(
      'Post Path "/id1/detail-2',
    )

    const detail1AddBtn = await screen.findByTestId('detail-btn-add-1')

    fireEvent.click(detail1AddBtn)

    expect(router.state.location.pathname).toBe(`/posts/id1/detail${tail}`)
    expect(router.state.location.search).toEqual({ _test: true })

    const detail1RemoveBtn = await screen.findByTestId('detail-btn-remove-1')

    fireEvent.click(detail1RemoveBtn)

    expect(router.state.location.pathname).toBe(`/posts/id1/detail${tail}`)
    expect(router.state.location.search).toEqual({})

    const detail2AddBtn = await screen.findByTestId('detail-btn-add-2')

    fireEvent.click(detail2AddBtn)

    expect(router.state.location.pathname).toBe(`/posts/id1/detail${tail}`)
    expect(router.state.location.search).toEqual({ _test: true })
  },
)

test.each([true, false])(
  'should navigate to from route when using "." in nested route structure from Index Route with trailingSlash: %s',
  async (trailingSlash: boolean) => {
    const tail = trailingSlash ? '/' : ''

    const rootRoute = createRootRoute()

    const IndexComponent = () => {
      const navigate = useNavigate()
      return (
        <>
          <button
            data-testid="posts-btn"
            onClick={() => {
              navigate({
                to: '/post',
              })
            }}
          >
            Post
          </button>
          <button
            data-testid="search-btn"
            onClick={() =>
              navigate({
                to: '.',
                search: {
                  param1: 'value1',
                },
              })
            }
          >
            Search
          </button>
          <button
            data-testid="home-btn"
            onClick={() =>
              navigate({
                from: '/',
                to: '.',
              })
            }
          >
            Go To Home
          </button>
          <Outlet />
        </>
      )
    }

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: IndexComponent,
      validateSearch: z.object({
        param1: z.string().optional(),
      }),
    })

    const postRoute = createRoute({
      getParentRoute: () => indexRoute,
      path: 'post',
      component: () => <div>Post</div>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postRoute]),
      history,
      trailingSlash: trailingSlash ? 'always' : 'never',
    })

    render(<RouterProvider router={router} />)

    const postButton = await screen.findByTestId('posts-btn')

    await act(() => fireEvent.click(postButton))

    expect(router.state.location.pathname).toBe(`/post${tail}`)

    const searchButton = await screen.findByTestId('search-btn')

    await act(() => fireEvent.click(searchButton))

    expect(router.state.location.pathname).toBe(`/post${tail}`)
    expect(router.state.location.search).toEqual({ param1: 'value1' })

    const homeBtn = await screen.findByTestId('home-btn')

    await act(() => fireEvent.click(homeBtn))

    expect(router.state.location.pathname).toBe(`/`)
    expect(router.state.location.search).toEqual({})
  },
)

test.each([true, false])(
  'should navigate to from route with path params when using "." in nested route structure with trailingSlash: %s',
  async (trailingSlash) => {
    const tail = trailingSlash ? '/' : ''
    const rootRoute = createRootRoute()

    const IndexComponent = () => {
      const navigate = useNavigate()
      return (
        <>
          <h1 data-testid="index-heading">Index</h1>
          <button
            data-testid="posts-btn"
            onClick={() => navigate({ to: '/posts' })}
          >
            Posts
          </button>
        </>
      )
    }

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: IndexComponent,
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      const navigate = postsRoute.useNavigate()
      return (
        <>
          <h1 data-testid="posts-index-heading">Posts</h1>
          <button
            data-testid="first-post-btn"
            onClick={() =>
              navigate({
                to: '$postId',
                params: { postId: '1' },
              })
            }
          >
            To first post
          </button>
          <button
            data-testid="second-post-btn"
            onClick={() =>
              navigate({
                to: '$postId',
                params: { postId: '2' },
              })
            }
          >
            To second post
          </button>
          <button
            data-testid="to-posts-index-btn"
            onClick={() =>
              navigate({
                from: '/posts',
                to: '.',
              })
            }
          >
            To posts list
          </button>
          <Outlet />
        </>
      )
    }

    const PostDetailComponent = () => {
      const navigate = postDetailRoute.useNavigate()
      return (
        <>
          <h1 data-testid="post-detail-index-heading">Post Detail</h1>
          <button
            data-testid="post-info-btn"
            onClick={() =>
              navigate({
                to: 'info',
              })
            }
          >
            To post info
          </button>
          <button
            data-testid="post-notes-btn"
            onClick={() =>
              navigate({
                to: 'notes',
              })
            }
          >
            To post notes
          </button>
          <button
            data-testid="to-post-detail-index-btn"
            onClick={() =>
              navigate({
                from: '/posts/$postId',
                to: '.',
              })
            }
          >
            To index detail options
          </button>
          <Outlet />
        </>
      )
    }

    const PostInfoComponent = () => {
      return (
        <>
          <h1 data-testid="post-info-heading">Post Info</h1>
        </>
      )
    }

    const PostNotesComponent = () => {
      return (
        <>
          <h1 data-testid="post-notes-heading">Post Notes</h1>
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const postDetailRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostDetailComponent,
    })

    const postInfoRoute = createRoute({
      getParentRoute: () => postDetailRoute,
      path: 'info',
      component: PostInfoComponent,
    })

    const postNotesRoute = createRoute({
      getParentRoute: () => postDetailRoute,
      path: 'notes',
      component: PostNotesComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([
          postsRoute.addChildren([
            postDetailRoute.addChildren([postInfoRoute, postNotesRoute]),
          ]),
        ]),
      ]),
      trailingSlash: trailingSlash ? 'always' : 'never',
    })

    render(<RouterProvider router={router} />)

    const postsButton = await screen.findByTestId('posts-btn')

    fireEvent.click(postsButton)

    expect(await screen.findByTestId('posts-index-heading')).toBeInTheDocument()
    expect(window.location.pathname).toEqual(`/posts${tail}`)

    const firstPostButton = await screen.findByTestId('first-post-btn')

    fireEvent.click(firstPostButton)

    expect(
      await screen.findByTestId('post-detail-index-heading'),
    ).toBeInTheDocument()
    expect(window.location.pathname).toEqual(`/posts/1${tail}`)

    const postInfoButton = await screen.findByTestId('post-info-btn')

    fireEvent.click(postInfoButton)

    expect(await screen.findByTestId('post-info-heading')).toBeInTheDocument()
    expect(window.location.pathname).toEqual(`/posts/1/info${tail}`)

    const toPostDetailIndexButton = await screen.findByTestId(
      'to-post-detail-index-btn',
    )

    fireEvent.click(toPostDetailIndexButton)

    expect(
      await screen.findByTestId('post-detail-index-heading'),
    ).toBeInTheDocument()
    expect(screen.queryByTestId('post-info-heading')).not.toBeInTheDocument()
    expect(window.location.pathname).toEqual(`/posts/1${tail}`)

    const postNotesButton = await screen.findByTestId('post-notes-btn')

    fireEvent.click(postNotesButton)

    expect(await screen.findByTestId('post-notes-heading')).toBeInTheDocument()
    expect(window.location.pathname).toEqual(`/posts/1/notes${tail}`)

    const toPostsIndexButton = await screen.findByTestId('to-posts-index-btn')

    fireEvent.click(toPostsIndexButton)

    expect(await screen.findByTestId('posts-index-heading')).toBeInTheDocument()
    expect(screen.queryByTestId('post-notes-heading')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('post-detail-index-heading'),
    ).not.toBeInTheDocument()
    expect(window.location.pathname).toEqual(`/posts${tail}`)

    const secondPostButton = await screen.findByTestId('second-post-btn')

    fireEvent.click(secondPostButton)

    expect(
      await screen.findByTestId('post-detail-index-heading'),
    ).toBeInTheDocument()
    expect(window.location.pathname).toEqual(`/posts/2${tail}`)
  },
)

describe('when on /posts/$postId and navigating to ../ with default `from` /posts', () => {
  async function runTest(navigateVia: 'Route' | 'RouteApi') {
    const rootRoute = createRootRoute()

    const IndexComponent = () => {
      const navigate = useNavigate()
      return (
        <>
          <h1 data-testid="index-heading">Index</h1>
          <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
          <button
            data-testid="index-to-first-post-btn"
            onClick={() =>
              navigate({
                to: '/posts/$postId/details',
                params: { postId: 'id1' },
              })
            }
          >
            To first post
          </button>
        </>
      )
    }

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: IndexComponent,
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      const routeNavigate = postsRoute.useNavigate()
      const routeApiNavigate = getRouteApi('/_layout/posts').useNavigate()
      return (
        <>
          <h1>Posts</h1>
          <button
            data-testid="btn-to-home"
            onClick={() => {
              if (navigateVia === 'Route') {
                routeNavigate({ to: '../' })
              } else {
                routeApiNavigate({ to: '../' })
              }
            }}
          >
            To Home
          </button>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params.postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const PostIndexComponent = () => {
      return (
        <>
          <h1>Post Index</h1>
        </>
      )
    }

    const postIndexRoute = createRoute({
      getParentRoute: () => postRoute,
      path: '/',
      component: PostIndexComponent,
    })

    const DetailsComponent = () => {
      return (
        <>
          <h1 data-testid="details-heading">Details!</h1>
        </>
      )
    }

    const detailsRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'details',
      component: DetailsComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([
          postsRoute.addChildren([
            postRoute.addChildren([postIndexRoute, detailsRoute]),
          ]),
        ]),
      ]),
    })

    render(<RouterProvider router={router} />)

    const postsButton = await screen.findByTestId('index-to-first-post-btn')

    fireEvent.click(postsButton)

    expect(await screen.findByTestId('details-heading')).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/details')

    const homeButton = await screen.findByTestId('btn-to-home')

    fireEvent.click(homeButton)

    expect(await screen.findByTestId('index-heading')).toBeInTheDocument()
    expect(window.location.pathname).toEqual('/')
  }

  test('Route', () => runTest('Route'))
  test('RouteApi', () => runTest('RouteApi'))
})

describe.each([{ basepath: '' }, { basepath: '/basepath' }])(
  'relative useNavigate with %s',
  ({ basepath }) => {
    const setupRouter = () => {
      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => {
          return <h1>Index Route</h1>
        },
      })
      const aRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: 'a',
        component: () => {
          return (
            <>
              <h1>A Route</h1>
              <Outlet />
            </>
          )
        },
      })

      const bRoute = createRoute({
        getParentRoute: () => aRoute,
        path: 'b',
        component: function BRoute() {
          const navigate = useNavigate()
          return (
            <>
              <h1>B Route</h1>
              <button onClick={() => navigate({ to: '..' })}>
                Link to Parent
              </button>
            </>
          )
        },
      })

      const paramRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: 'param/$param',
        component: function ParamRoute() {
          const navigate = useNavigate()
          return (
            <>
              <h1>Param Route</h1>
              <button
                onClick={() =>
                  navigate({ from: paramRoute.fullPath, to: './a' })
                }
              >
                Link to ./a
              </button>
              <button
                data-testid="btn-param-bar"
                onClick={() =>
                  navigate({ to: '.', params: { param: 'bar' } as any })
                }
              >
                Navigate to . with param:bar
              </button>
              <Outlet />
            </>
          )
        },
      })

      const paramARoute = createRoute({
        getParentRoute: () => paramRoute,
        path: 'a',
        component: function ParamARoute() {
          const navigate = useNavigate()
          return (
            <>
              <h1>Param A Route</h1>
              <button
                onClick={() =>
                  navigate({ from: paramARoute.fullPath, to: '..' })
                }
              >
                Link to .. from /param/foo/a
              </button>
              <button
                onClick={() => navigate({ to: '..' })}
                data-testid={'link-to-previous'}
              >
                Link to .. from current active route
              </button>
              <Outlet />
            </>
          )
        },
      })

      const paramBRoute = createRoute({
        getParentRoute: () => paramARoute,
        path: 'b',
        component: function ParamBRoute() {
          const navigate = useNavigate()
          return (
            <>
              <h1>Param B Route</h1>
              <button onClick={() => navigate({ to: '..' })}>
                Link to Parent
              </button>
              <button
                onClick={() => navigate({ to: '..', params: { param: 'bar' } })}
              >
                Link to Parent with param:bar
              </button>
              <button
                onClick={() => navigate({ to: '..', params: { param: 'bar' } })}
              >
                Link to Parent with param:bar functional
              </button>
            </>
          )
        },
      })

      return createRouter({
        routeTree: rootRoute.addChildren([
          indexRoute,
          aRoute.addChildren([bRoute]),
          paramRoute.addChildren([paramARoute, paramBRoute]),
        ]),
        history,
        basepath: basepath === '' ? undefined : basepath,
      })
    }

    test('should navigate to the parent route', async () => {
      const router = setupRouter()

      render(<RouterProvider router={router} />)

      // Navigate to /a/b
      await act(async () => {
        history.push(`${basepath}/a/b`)
      })

      // Inspect the link to go up a parent
      const parentLink = await screen.findByText('Link to Parent')

      // Click the link and ensure the new location
      fireEvent.click(parentLink)
      await router.latestLoadPromise

      expect(window.location.pathname).toBe(`${basepath}/a`)
    })

    test('should navigate to the parent route and keep params', async () => {
      const router = setupRouter()

      render(<RouterProvider router={router} />)

      // Navigate to /param/oldParamValue/a/b
      await act(async () => {
        history.push(`${basepath}/param/foo/a/b`)
      })

      // Inspect the link to go up a parent and keep the params
      const parentLink = await screen.findByText('Link to Parent')

      // Click the link and ensure the new location
      fireEvent.click(parentLink)
      await router.latestLoadPromise

      expect(window.location.pathname).toBe(`${basepath}/param/foo/a`)
    })

    test('should navigate to the parent route and change params', async () => {
      const router = setupRouter()

      render(<RouterProvider router={router} />)

      // Navigate to /param/oldParamValue/a/b
      await act(async () => {
        history.push(`${basepath}/param/foo/a/b`)
      })

      // Inspect the link to go up a parent and keep the params
      const parentLink = await screen.findByText(
        'Link to Parent with param:bar',
      )

      // Click the link and ensure the new location
      fireEvent.click(parentLink)
      await router.latestLoadPromise

      expect(window.location.pathname).toBe(`${basepath}/param/bar/a`)
    })

    test('should navigate to a relative link based on render location with basepath', async () => {
      const router = setupRouter()

      render(<RouterProvider router={router} />)

      await act(async () => {
        history.push(`${basepath}/param/foo/a/b`)
      })

      // Inspect the relative link to ./a
      const relativeLink = await screen.findByText('Link to ./a')

      // Click the link and ensure the new location
      fireEvent.click(relativeLink)
      await router.latestLoadPromise

      expect(window.location.pathname).toBe(`${basepath}/param/foo/a`)
    })

    test('should navigate to a parent link based on render location', async () => {
      const router = setupRouter()

      render(<RouterProvider router={router} />)

      await act(async () => {
        history.push(`${basepath}/param/foo/a/b`)
      })

      // Inspect the relative link to ./a
      const relativeLink = await screen.findByText(
        'Link to .. from /param/foo/a',
      )

      // Click the link and ensure the new location
      fireEvent.click(relativeLink)
      await router.latestLoadPromise

      expect(window.location.pathname).toBe(`${basepath}/param/foo`)
    })

    test('should navigate to a parent link based on active location', async () => {
      const router = setupRouter()

      render(<RouterProvider router={router} />)

      await act(async () => {
        history.push(`${basepath}/param/foo/a/b`)
      })

      const relativeLink = await screen.findByTestId('link-to-previous')

      // Click the link and ensure the new location
      fireEvent.click(relativeLink)
      await router.latestLoadPromise

      expect(window.location.pathname).toBe(`${basepath}/param/foo/a`)
    })

    test('should navigate to same route with different params', async () => {
      const router = setupRouter()

      render(<RouterProvider router={router} />)

      await act(async () => {
        history.push(`${basepath}/param/foo/a/b`)
        await router.latestLoadPromise
      })
      expect(window.location.pathname).toBe(`${basepath}/param/foo/a/b`)

      const btn = screen.getByTestId('btn-param-bar')
      fireEvent.click(btn)
      await router.latestLoadPromise

      expect(window.location.pathname).toBe(`${basepath}/param/bar/a/b`)
    })
  },
)

describe('splat routes with empty splat', () => {
  test.each(Object.values(trailingSlashOptions))(
    'should handle empty _splat parameter with trailingSlash: %s',
    async (trailingSlash) => {
      const tail = trailingSlash === 'always' ? '/' : ''

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: function IndexComponent() {
          const navigate = useNavigate()
          return (
            <>
              <h1>Index Route</h1>
              <button
                data-testid="splat-btn-with-empty-splat"
                onClick={() =>
                  navigate({
                    to: '/splat/$',
                    params: { _splat: '' },
                  })
                }
                type="button"
              >
                Navigate to splat with empty _splat
              </button>
              <button
                data-testid="splat-btn-with-undefined-splat"
                onClick={() =>
                  navigate({
                    to: '/splat/$',
                    params: { _splat: undefined },
                  })
                }
                type="button"
              >
                Navigate to splat with undefined _splat
              </button>
              <button
                data-testid="splat-btn-with-no-splat"
                onClick={() =>
                  navigate({
                    to: '/splat/$',
                    params: {},
                  })
                }
                type="button"
              >
                Navigate to splat with no _splat
              </button>
            </>
          )
        },
      })

      const splatRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: 'splat/$',
        component: () => {
          return <h1>Splat Route</h1>
        },
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute, splatRoute]),
        history,
        trailingSlash,
      })

      render(<RouterProvider router={router} />)

      // Navigate with empty _splat
      const splatBtnWithEmptySplat = await screen.findByTestId(
        'splat-btn-with-empty-splat',
      )

      await act(async () => {
        fireEvent.click(splatBtnWithEmptySplat)
      })

      expect(window.location.pathname).toBe(`/splat${tail}`)
      expect(await screen.findByText('Splat Route')).toBeInTheDocument()

      // Navigate back to index
      await act(async () => {
        history.push('/')
      })

      // Navigate with undefined _splat
      const splatBtnWithUndefinedSplat = await screen.findByTestId(
        'splat-btn-with-undefined-splat',
      )

      await act(async () => {
        fireEvent.click(splatBtnWithUndefinedSplat)
      })

      expect(window.location.pathname).toBe(`/splat${tail}`)
      expect(await screen.findByText('Splat Route')).toBeInTheDocument()

      // Navigate back to index
      await act(async () => {
        history.push('/')
      })

      // Navigate with no _splat
      const splatBtnWithNoSplat = await screen.findByTestId(
        'splat-btn-with-no-splat',
      )

      await act(async () => {
        fireEvent.click(splatBtnWithNoSplat)
      })

      expect(window.location.pathname).toBe(`/splat${tail}`)
      expect(await screen.findByText('Splat Route')).toBeInTheDocument()
    },
  )
})

describe('encoded and unicode paths', () => {
  const testCases = [
    {
      name: 'with prefix',
      path: '/foo/prefix@대{$}',
      expectedPath:
        '/foo/prefix@%EB%8C%80test[s%5C/.%5C/parameter%25!%F0%9F%9A%80%40]',
      expectedLocation: '/foo/prefix@대test[s%5C/.%5C/parameter%25!🚀%40]',
      params: {
        _splat: 'test[s\\/.\\/parameter%!🚀@]',
        '*': 'test[s\\/.\\/parameter%!🚀@]',
      },
    },
    {
      name: 'with suffix',
      path: '/foo/{$}대suffix@',
      expectedPath:
        '/foo/test[s%5C/.%5C/parameter%25!%F0%9F%9A%80%40]%EB%8C%80suffix@',
      expectedLocation: '/foo/test[s%5C/.%5C/parameter%25!🚀%40]대suffix@',
      params: {
        _splat: 'test[s\\/.\\/parameter%!🚀@]',
        '*': 'test[s\\/.\\/parameter%!🚀@]',
      },
    },
    {
      name: 'with wildcard',
      path: '/foo/$',
      expectedPath: '/foo/test[s%5C/.%5C/parameter%25!%F0%9F%9A%80]',
      expectedLocation: '/foo/test[s%5C/.%5C/parameter%25!🚀]',
      params: {
        _splat: 'test[s\\/.\\/parameter%!🚀]',
        '*': 'test[s\\/.\\/parameter%!🚀]',
      },
    },
    // '/' is left as is with splat params but encoded with normal params
    {
      name: 'with path param',
      path: `/foo/$id`,
      expectedPath: '/foo/test[s%5C%2F.%5C%2Fparameter%25!%F0%9F%9A%80%40]',
      expectedLocation: '/foo/test[s%5C%2F.%5C%2Fparameter%25!🚀%40]',
      params: {
        id: 'test[s\\/.\\/parameter%!🚀@]',
      },
    },
  ]

  test.each(testCases)(
    'should handle encoded, decoded paths with unicode characters correctly - $name',
    async ({ path, expectedPath, expectedLocation, params }) => {
      const rootRoute = createRootRoute()

      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: IndexComponent,
      })

      function IndexComponent() {
        const navigate = useNavigate()

        return (
          <>
            <h1>Index Route</h1>
            <button
              data-testid="btn-to-path"
              onClick={() => navigate({ to: path, params })}
            >
              Navigate to path
            </button>
          </>
        )
      }

      const pathRoute = createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: PathRouteComponent,
      })

      function PathRouteComponent() {
        const params = pathRoute.useParams()
        return (
          <div>
            <h1>Path Route</h1>
            <p>
              params:{' '}
              <span data-testid="params-to-validate">
                {JSON.stringify(params)}
              </span>
            </p>
          </div>
        )
      }

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute, pathRoute]),
        history,
      })

      render(<RouterProvider router={router} />)

      const link = await screen.findByTestId('btn-to-path')

      await act(() => fireEvent.click(link))

      const paramsToValidate = await screen.findByTestId('params-to-validate')

      expect(window.location.pathname).toBe(expectedPath)
      expect(router.latestLocation.pathname).toBe(expectedLocation)

      expect(paramsToValidate.textContent).toEqual(JSON.stringify(params))
    },
  )
})

test('when navigating to /auth/sign-in with literal path (no params)', async () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()
    return (
      <>
        <h1>Index</h1>
        <button
          data-testid="navigate-btn"
          onClick={() => navigate({ to: '/auth/sign-in' })}
        >
          Navigate to Sign In
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const authRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/auth/$path',
    component: () => {
      const params = authRoute.useParams()
      return (
        <div>
          <h1 data-testid="auth-heading">Auth Route</h1>
          <span data-testid="path-param">{params.path}</span>
        </div>
      )
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, authRoute]),
    history,
  })

  render(<RouterProvider router={router} />)

  const btn = await screen.findByTestId('navigate-btn')

  // First click should navigate successfully
  await act(() => fireEvent.click(btn))

  // Should be at /auth/sign-in with correct params
  expect(window.location.pathname).toBe('/auth/sign-in')
  expect(await screen.findByTestId('auth-heading')).toBeInTheDocument()
  expect((await screen.findByTestId('path-param')).textContent).toBe('sign-in')
})
