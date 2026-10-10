import { expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library'
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useParams,
} from '../src'

test('useParams must return parsed result if applicable.', async () => {
  const posts = [
    {
      id: 1,
      title: 'First Post',
      category: 'one',
    },
    {
      id: 2,
      title: 'Second Post',
      category: 'two',
    },
  ]

  const mockedfn = vi.fn()
  const rootRoute = createRootRoute()

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'posts',
    component: PostsComponent,
  })

  const postCategoryRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: 'category_{$category}',
    component: PostCategoryComponent,
    params: {
      parse: (params) => {
        return {
          ...params,
          category:
            params.category === 'first'
              ? 'one'
              : params.category === 'second'
                ? 'two'
                : params.category,
        }
      },
      stringify: (params) => {
        return {
          category:
            params.category === 'one'
              ? 'first'
              : params.category === 'two'
                ? 'second'
                : params.category,
        }
      },
    },
    loader: ({ params }) => ({
      posts:
        params.category === 'all'
          ? posts
          : posts.filter((post) => post.category === params.category),
    }),
  })

  const postRoute = createRoute({
    getParentRoute: () => postCategoryRoute,
    path: '$postId',
    params: {
      parse: (params) => {
        mockedfn()
        return {
          ...params,
          postId: params.postId === 'one' ? '1' : '2',
        }
      },
    },
    component: PostComponent,
    loader: ({ params }) => ({
      post: posts.find((post) => post.id === parseInt(params.postId)),
    }),
  })

  function PostsComponent() {
    return (
      <div>
        <h1 data-testid="posts-heading">Posts</h1>
        <Link
          data-testid="all-category-link"
          to={postCategoryRoute.fullPath}
          params={{ category: 'all' }}
        >
          All Categories
        </Link>
        <Link
          data-testid="first-category-link"
          to={postCategoryRoute.fullPath}
          params={{ category: 'first' }}
        >
          First Category
        </Link>
        <Outlet />
      </div>
    )
  }

  function PostCategoryComponent() {
    const data = postCategoryRoute.useLoaderData()

    return (
      <div>
        <h1 data-testid="post-category-heading">Post Categories</h1>
        {data().posts.map((post: (typeof posts)[number]) => {
          const id = post.id === 1 ? 'one' : 'two'
          return (
            <Link
              from={postCategoryRoute.fullPath}
              to="./$postId"
              params={{ postId: id }}
              data-testid={`post-${id}-link`}
            >
              {post.title}
            </Link>
          )
        })}
        <Outlet />
      </div>
    )
  }

  function PostComponent() {
    const params = useParams({ from: postRoute.fullPath })

    const data = postRoute.useLoaderData()

    return (
      <div>
        <h1 data-testid="post-heading">Post Route</h1>
        <div>
          Category_Param:{' '}
          <span data-testid="param_category_value">{params().category}</span>
        </div>
        <div>
          PostId_Param:{' '}
          <span data-testid="param_postId_value">{params().postId}</span>
        </div>
        <div>
          PostId: <span data-testid="post_id_value">{data().post.id}</span>
        </div>
        <div>
          Title: <span data-testid="post_title_value">{data().post.title}</span>
        </div>
        <div>
          Category:{' '}
          <span data-testid="post_category_value">{data().post.category}</span>
        </div>
      </div>
    )
  }

  window.history.replaceState({}, '', '/posts')

  const router = createRouter({
    routeTree: rootRoute.addChildren([
      postsRoute.addChildren([postCategoryRoute.addChildren([postRoute])]),
    ]),
  })

  render(() => <RouterProvider router={router} />)

  await waitFor(() => router.load())

  expect(await screen.findByTestId('posts-heading')).toBeInTheDocument()

  const firstCategoryLink = await screen.findByTestId('first-category-link')

  expect(firstCategoryLink).toBeInTheDocument()

  mockedfn.mockClear()
  await waitFor(() => fireEvent.click(firstCategoryLink))

  const firstPostLink = await screen.findByTestId('post-one-link')

  expect(window.location.pathname).toBe('/posts/category_first')
  expect(await screen.findByTestId('post-category-heading')).toBeInTheDocument()
  // Dev-only buildLocation roundtrip validation uses normal matching for links.
  expect(mockedfn).toHaveBeenCalled()

  mockedfn.mockClear()
  await waitFor(() => fireEvent.click(firstPostLink))

  const allCategoryLink = await screen.findByTestId('all-category-link')
  let paramCategoryValue = await screen.findByTestId('param_category_value')
  let paramPostIdValue = await screen.findByTestId('param_postId_value')
  let postCategory = await screen.findByTestId('post_category_value')
  let postTitleValue = await screen.findByTestId('post_title_value')
  let postIdValue = await screen.findByTestId('post_id_value')
  let renderedPost = {
    id: parseInt(postIdValue.textContent),
    title: postTitleValue.textContent,
    category: postCategory.textContent,
  }

  expect(window.location.pathname).toBe('/posts/category_first/one')
  expect(await screen.findByTestId('post-heading')).toBeInTheDocument()
  expect(renderedPost).toEqual(posts[0])
  expect(renderedPost.category).toBe('one')
  expect(paramCategoryValue.textContent).toBe('one')
  expect(paramPostIdValue.textContent).toBe('1')
  expect(mockedfn).toHaveBeenCalled()
  // maybe we could theoretically reach 1 single call, but i'm not sure, building links depends on a bunch of things
  // expect(mockedfn).toHaveBeenCalledTimes(1)
  expect(allCategoryLink).toBeInTheDocument()

  mockedfn.mockClear()
  await waitFor(() => fireEvent.click(allCategoryLink))

  const secondPostLink = await screen.findByTestId('post-two-link')

  expect(window.location.pathname).toBe('/posts/category_all')
  expect(await screen.findByTestId('post-category-heading')).toBeInTheDocument()
  expect(secondPostLink).toBeInTheDocument()
  // expect(mockedfn).not.toHaveBeenCalled()

  mockedfn.mockClear()
  await waitFor(() => fireEvent.click(secondPostLink))

  paramCategoryValue = await screen.findByTestId('param_category_value')
  paramPostIdValue = await screen.findByTestId('param_postId_value')
  postCategory = await screen.findByTestId('post_category_value')
  postTitleValue = await screen.findByTestId('post_title_value')
  postIdValue = await screen.findByTestId('post_id_value')
  renderedPost = {
    id: parseInt(postIdValue.textContent),
    title: postTitleValue.textContent,
    category: postCategory.textContent,
  }

  expect(window.location.pathname).toBe('/posts/category_all/two')
  expect(await screen.findByTestId('post-heading')).toBeInTheDocument()
  expect(renderedPost).toEqual(posts[1])
  expect(renderedPost.category).toBe('two')
  expect(paramCategoryValue.textContent).toBe('all')
  expect(paramPostIdValue.textContent).toBe('2')
  expect(mockedfn).toHaveBeenCalled()
})
