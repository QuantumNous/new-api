---
id: server-components
title: Server Components
---

> [!WARNING]
> Server Components are experimental! The API may see refinements.

Server Components let you render React components on the server and stream them to the client. Heavy dependencies stay out of your bundle, data fetching lives in the component, and sensitive logic never reaches the browser.

## Setup

**Server Components are not enabled by default.** Complete these three steps first:

### 1. Install Build Tool-Specific RSC Dependencies

<!-- ::start:tabs variant="bundler" -->

# Vite

```bash
npm install -D @vitejs/plugin-rsc
# or
pnpm add -D @vitejs/plugin-rsc
# or
yarn add -D @vitejs/plugin-rsc
# or
bun add -D @vitejs/plugin-rsc
```

# Rsbuild

Rsbuild does not need a separate RSC plugin. Make sure your Rsbuild React dependencies are installed:

```bash
npm install -D @rsbuild/core @rsbuild/plugin-react
```

<!-- ::end:tabs -->

### 2. Configure Your Build Tool

Update your build tool config to enable RSC in the TanStack Start plugin:

<!-- ::start:tabs variant="bundler" -->

# Vite

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import rsc from '@vitejs/plugin-rsc'

export default defineConfig({
  plugins: [
    tanstackStart({
      rsc: {
        enabled: true,
      },
    }),
    rsc(),
    viteReact(),
  ],
})
```

# Rsbuild

```ts title="rsbuild.config.ts"
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

export default defineConfig({
  plugins: [
    pluginReact({ splitChunks: false }),
    tanstackStart({
      rsc: {
        enabled: true,
      },
    }),
  ],
})
```

<!-- ::end:tabs -->

**Requirements:** React 19+, Vite 7+ or Rsbuild 2+

## Quick Start

In TanStack Start, you typically create server-rendered UI in a server function, then return it through a route `loader`.

There are two high-level RSC helpers:

- `renderServerComponent(<Element />)` returns a **renderable value** you can inline like `{Renderable}`.
- `createCompositeComponent((props) => <Element />)` returns a **composite source** rendered via `<CompositeComponent src={...} />` (supports slots).

### Renderable (no slots)

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'

function Greeting() {
  return <h1>Hello from RSC</h1>
}

const getGreeting = createServerFn().handler(async () => {
  const Renderable = await renderServerComponent(<Greeting />)
  return { Renderable }
})

export const Route = createFileRoute('/')({
  loader: async () => {
    const { Renderable } = await getGreeting()
    return { Greeting: Renderable }
  },
  component: HomePage,
})

function HomePage() {
  const { Greeting } = Route.useLoaderData()
  return <>{Greeting}</>
}
```

### Composite (slots)

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'

const getCard = createServerFn().handler(async () => {
  const src = await createCompositeComponent(
    (props: { children?: React.ReactNode }) => (
      <div className="card">
        <h2>Server-rendered header</h2>
        <div>{props.children}</div>
      </div>
    ),
  )

  return { src }
})

export const Route = createFileRoute('/')({
  loader: async () => ({
    Card: await getCard(),
  }),
  component: HomePage,
})

function HomePage() {
  const { Card } = Route.useLoaderData()

  return (
    <CompositeComponent src={Card.src}>
      <Counter />
    </CompositeComponent>
  )
}
```

## Why Server Components?

- **Smaller bundles.** Markdown parsers, syntax highlighters, and heavy libraries run on the server. Only rendered HTML reaches the client.
- **Colocated data fetching.** Fetch data directly in the component that needs it.
- **Secure by default.** API keys, database queries, and business logic never appear in the client bundle.
- **Progressive streaming.** UI streams to the browser as it renders. Users see content immediately.

## Passing Props and Composition

Renderable values returned from `renderServerComponent` do not support slots.

To accept client-provided props ("slots"), use `createCompositeComponent` and render it with `<CompositeComponent src={...} />`.

Slots are declared on the server component props. There are three types of slots:

| Slot Type       | Use Case                                          | Server Can Pass Data? |
| --------------- | ------------------------------------------------- | --------------------- |
| `children`      | Simple composition                                | No                    |
| Render props    | Server passes data to client-rendered content     | Yes                   |
| Component props | Pass reusable components that receive server data | Yes                   |

### Children Slots

Pass client components as children. Simple and familiar, but the server cannot pass data to them:

```tsx
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'

const getCard = createServerFn().handler(async () => {
  const src = await createCompositeComponent(
    (props: { children?: React.ReactNode }) => (
      <div className="card">
        <h2>Server-rendered header</h2>
        <div>{props.children}</div>
      </div>
    ),
  )

  return { src }
})

function MyPage() {
  const { src } = Route.useLoaderData()

  return (
    <CompositeComponent src={src}>
      {/* Client components with full interactivity */}
      <Counter />
      <button onClick={() => alert('Clicked!')}>Click me</button>
    </CompositeComponent>
  )
}
```

### Render Props

Use render props when the server needs to pass data to client-rendered content:

```tsx
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'

const getPost = createServerFn()
  .validator(z.object({ postId: z.string() }))
  .handler(async ({ data }) => {
    const post = await db.posts.findById(data.postId)

    const src = await createCompositeComponent(
      (props: {
        children?: React.ReactNode
        renderActions?: (data: {
          postId: string
          authorId: string
        }) => React.ReactNode
      }) => (
        <article>
          <h1>{post.title}</h1>
          <p>{post.body}</p>
          <footer>
            {props.renderActions?.({
              postId: post.id,
              authorId: post.authorId,
            })}
          </footer>
          {props.children}
        </article>
      ),
    )

    return { src }
  })

function PostPage() {
  const { src } = Route.useLoaderData()

  return (
    <CompositeComponent
      src={src}
      renderActions={({ postId, authorId }) => (
        <PostActions postId={postId} authorId={authorId} />
      )}
    >
      <Comments />
    </CompositeComponent>
  )
}
```

### Component Props

Pass React components as props. On the client, the passed in props will be rendered with data supplied by the server:

```tsx
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'

const getProductCard = createServerFn()
  .validator(z.object({ productId: z.string() }))
  .handler(async ({ data }) => {
    const product = await db.products.findById(data.productId)

    const src = await createCompositeComponent(
      ({
        AddToCart,
      }: {
        AddToCart: React.ComponentType<{ productId: string; price: number }>
      }) => (
        <div className="product-card">
          <h2>{product.name}</h2>
          <p>${product.price}</p>
          <AddToCart productId={product.id} price={product.price} />
        </div>
      ),
    )

    return { src }
  })

// Client component with interactivity
function AddToCartButton({
  productId,
  price,
}: {
  productId: string
  price: number
}) {
  const [added, setAdded] = React.useState(false)

  return (
    <button onClick={() => setAdded(true)}>
      {added ? '✓ Added!' : `Add to Cart - $${price}`}
    </button>
  )
}

function ProductPage() {
  const { src } = Route.useLoaderData()

  return <CompositeComponent src={src} AddToCart={AddToCartButton} />
}
```

Component props are useful when:

- You want to pass reusable client components
- The component needs its own state or event handlers
- You prefer component composition over render prop callbacks

All three slot types can be combined. `createCompositeComponent` provides full type safety for slot props.

## Caching

Server components work with TanStack Router's built-in caching. The cache key is the route path plus params:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => ({
    Post: await getPost({ data: { postId: params.postId } }),
  }),
  component: PostPage,
})
```

Navigate to `/posts/abc`, then `/posts/xyz`, then back to `/posts/abc` - the cached component renders instantly.

Control freshness with `staleTime`:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  staleTime: 10_000, // Fresh for 10 seconds
  loader: async ({ params }) => ({
    Post: await getPost({ data: { postId: params.postId } }),
  }),
  component: PostPage,
})
```

For cache keys beyond route params, use `loaderDeps`:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loaderDeps: ({ search }) => ({ tab: search.tab }),
  loader: async ({ params, deps }) => ({
    Post: await getPost({ data: { postId: params.postId, tab: deps.tab } }),
  }),
  component: PostPage,
})
```

### TanStack Query

For fine-grained control, use TanStack Query:

```tsx
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query'

const postQueryOptions = (postId: string) => ({
  queryKey: ['post', postId],
  structuralSharing: false, // Required - RSC values must not be merged
  queryFn: () => getPost({ data: { postId } }),
  staleTime: 5 * 60 * 1000,
})

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ context, params }) => {
    // Prefetch during SSR - data reused on client without refetch
    await context.queryClient.ensureQueryData(postQueryOptions(params.postId))
  },
  component: PostPage,
})

function PostPage() {
  const { postId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data } = useSuspenseQuery(postQueryOptions(postId))

  const handleRefresh = () => {
    // Manually refetch the RSC
    queryClient.refetchQueries({ queryKey: ['post', postId] })
  }

  return <CompositeComponent src={data.src} />
}
```

> [!IMPORTANT]
> Always set `structuralSharing: false` when caching server components with React Query. Without this, React Query may attempt to merge RSC values between fetches, which can cause errors.

### Invalidation

To refetch a server component after data changes, use `router.invalidate()`:

```tsx
import { useRouter } from '@tanstack/react-router'

function PostPage() {
  const router = useRouter()
  const { Post } = Route.useLoaderData()

  const handleUpdate = async () => {
    await updatePost({ data: { ... } })
    // Refetch the route's loader, including the RSC
    router.invalidate()
  }

  return (
    <CompositeComponent
      src={Post.src}
      renderActions={() => (
        <button onClick={handleUpdate}>Update Post</button>
      )}
    />
  )
}
```

This pattern is useful when server functions mutate data that the RSC displays. After the mutation completes, `router.invalidate()` triggers the loader to run again, fetching a fresh server component with updated data.

## Combining with Selective SSR

Server Components pair with [Selective SSR](./selective-ssr.md) when you need server-rendered content but client-only rendering for the route component itself.

### Example: `ssr: 'data-only'`

The server fetches the RSC, but the route component renders on the client:

```tsx
export const Route = createFileRoute('/dashboard')({
  ssr: 'data-only',
  loader: async () => ({
    Dashboard: await getDashboard(),
  }),
  component: DashboardPage,
})

function DashboardPage() {
  const { Dashboard } = Route.useLoaderData()
  const [width, setWidth] = React.useState(0)

  React.useEffect(() => {
    setWidth(window.innerWidth) // Browser API
  }, [])

  return (
    <Dashboard
      renderChart={({ data }) => <ResponsiveChart data={data} width={width} />}
    />
  )
}
```

This is useful when:

- The server component fetches data and renders static content
- The route component needs `window`, `localStorage`, or other browser APIs
- You want the server component data ready before the client renders

### Example: `ssr: false`

Both loader and component run on the client:

```tsx
export const Route = createFileRoute('/canvas')({
  ssr: false,
  loader: async () => {
    const savedState = localStorage.getItem('canvas-state')
    return { Tools: await getDrawingTools({ data: { savedState } }) }
  },
  component: CanvasPage,
})
```

Use this when the loader itself requires browser APIs.

## Advanced Patterns

### Multiple Server Components in Parallel

When a page needs several independent server components, fetch them in parallel using `Promise.all`. Each component renders independently with its own data.

**When to use:** Components from separate data sources with no shared dependencies. Maximizes concurrency when each component has independent fetch logic.

```tsx
const getArticleA = createServerFn().handler(async () => {
  const article = await db.articles.findById('a')
  return renderServerComponent(<Article data={article} />)
})

const getArticleB = createServerFn().handler(async () => {
  const article = await db.articles.findById('b')
  return renderServerComponent(<Article data={article} />)
})

const getSidebar = createServerFn().handler(async () => {
  const trending = await db.articles.getTrending()
  return renderServerComponent(<Sidebar items={trending} />)
})

export const Route = createFileRoute('/news')({
  loader: async () => {
    const [ArticleA, ArticleB, Sidebar] = await Promise.all([
      getArticleA(),
      getArticleB(),
      getSidebar(),
    ])
    return { ArticleA, ArticleB, Sidebar }
  },
  component: NewsPage,
})

function NewsPage() {
  const { ArticleA, ArticleB, Sidebar } = Route.useLoaderData()

  return (
    <div className="grid">
      <main>
        {ArticleA}
        {ArticleB}
      </main>
      <aside>{Sidebar}</aside>
    </div>
  )
}
```

Each server function executes concurrently. The page renders when all complete.

### Bundling Multiple Components

Return multiple server components from a single server function when they share data or should be fetched together. This reduces network round trips.

**When to use:** Components that share fetched data, need a single cache key, or should invalidate together. Reduces database queries and network round trips.

#### Using Promise.all

Create multiple `renderServerComponent` or `createCompositeComponent` calls and return them as an object:

```tsx
const getPageLayout = createServerFn().handler(async () => {
  // Fetch shared data once
  const user = await db.users.getCurrent()
  const config = await db.config.get()

  // Create multiple components that share this data
  const [Header, Content, Footer] = await Promise.all([
    renderServerComponent(
      <header>
        <Logo />
        <nav>
          {config.navItems.map((item) => (
            <NavLink key={item.id} {...item} />
          ))}
        </nav>
        <UserMenu name={user.name} />
      </header>,
    ),
    renderServerComponent(
      <main>
        <h1>Welcome, {user.name}</h1>
        <Dashboard stats={user.stats} />
      </main>,
    ),
    renderServerComponent(
      <footer>
        <span>{config.copyright}</span>
        {config.footerLinks.map((link) => (
          <a key={link.id} href={link.url}>
            {link.label}
          </a>
        ))}
      </footer>,
    ),
  ])

  return { Header, Content, Footer }
})

export const Route = createFileRoute('/dashboard')({
  loader: async () => await getPageLayout(),
  component: DashboardPage,
})

function DashboardPage() {
  const { Header, Content, Footer } = Route.useLoaderData()

  return (
    <>
      {Header}
      {Content}
      {Footer}
    </>
  )
}
```

#### Using Nested Structures

Alternatively, return a nested object structure from a single server function.

- Use `renderServerComponent` when you just need renderables (no slots).
- Use `createCompositeComponent` when you want each part to accept slots.

```tsx
const getPageLayout = createServerFn().handler(async () => {
  const user = await db.users.getCurrent()
  const config = await db.config.get()

  const [Header, Content, Footer] = await Promise.all([
    createCompositeComponent((props: { children?: React.ReactNode }) => (
      <header>
        <Logo />
        <nav>
          {config.navItems.map((item) => (
            <NavLink key={item.id} {...item} />
          ))}
        </nav>
        <UserMenu name={user.name} />
        {props.children}
      </header>
    )),
    createCompositeComponent(
      (props: { renderActions?: () => React.ReactNode }) => (
        <main>
          <h1>Welcome, {user.name}</h1>
          <Dashboard stats={user.stats} />
          {props.renderActions?.()}
        </main>
      ),
    ),
    createCompositeComponent(() => (
      <footer>
        <span>{config.copyright}</span>
        {config.footerLinks.map((link) => (
          <a key={link.id} href={link.url}>
            {link.label}
          </a>
        ))}
      </footer>
    )),
  ])

  return { Header, Content, Footer }
})

export const Route = createFileRoute('/dashboard')({
  loader: async () => ({
    Layout: await getPageLayout(),
  }),
  component: DashboardPage,
})
```

Render nested composites using dot notation:

```tsx
import { CompositeComponent } from '@tanstack/react-start/rsc'

function DashboardPage() {
  const { Layout } = Route.useLoaderData()

  return (
    <>
      <CompositeComponent src={Layout.Header}>
        <button onClick={() => setMenuOpen(true)}>Menu</button>
      </CompositeComponent>
      <CompositeComponent
        src={Layout.Content}
        renderActions={() => <ActionButtons />}
      />
      <CompositeComponent src={Layout.Footer} />
    </>
  )
}
```

Or destructure them from the loader data:

```tsx
import { CompositeComponent } from '@tanstack/react-start/rsc'

function DashboardPage() {
  const { Header, Content, Footer } = Route.useLoaderData().Layout

  return (
    <>
      <CompositeComponent src={Header}>
        <button onClick={() => setMenuOpen(true)}>Menu</button>
      </CompositeComponent>
      <CompositeComponent
        src={Content}
        renderActions={() => <ActionButtons />}
      />
      <CompositeComponent src={Footer} />
    </>
  )
}
```

Each nested component receives its own slot props independently. The `children` passed to `<CompositeComponent src={Header}>` only affects that component, not the others.

All three components share the same user and config data from a single database query.

### Deferred Component Loading

Return promises for server components instead of awaiting them. The client uses `React.use()` with `Suspense` to render each component as it resolves.

**When to use:** Components with varying data latencies where faster results should render before slower ones complete. Avoids blocking on the slowest query.

```tsx
import { Suspense, use } from 'react'

const getDashboardBundle = createServerFn().handler(() => ({
  // Fast - resolves in ~100ms
  QuickStats: (async () => {
    const stats = await cache.getStats() // Fast cache hit
    return renderServerComponent(<StatsCard data={stats} />)
  })(),

  // Medium - resolves in ~500ms
  RecentActivity: (async () => {
    const activity = await db.activity.getRecent()
    return renderServerComponent(<ActivityFeed items={activity} />)
  })(),

  // Slow - resolves in ~2000ms
  Analytics: (async () => {
    const data = await analytics.computeMetrics() // Expensive query
    return renderServerComponent(<AnalyticsChart data={data} />)
  })(),
}))

export const Route = createFileRoute('/dashboard')({
  loader: () => getDashboardBundle(),
  component: DashboardPage,
})

function DashboardPage() {
  const { QuickStats, RecentActivity, Analytics } = Route.useLoaderData()

  return (
    <div>
      <Suspense fallback={<Skeleton />}>
        <Deferred promise={QuickStats} />
      </Suspense>

      <Suspense fallback={<Skeleton />}>
        <Deferred promise={RecentActivity} />
      </Suspense>

      <Suspense fallback={<Skeleton />}>
        <Deferred promise={Analytics} />
      </Suspense>
    </div>
  )
}

function Deferred({ promise }: { promise: Promise<unknown> }) {
  const Renderable = use(promise)
  return <>{Renderable}</>
}
```

QuickStats appears first, RecentActivity follows, then Analytics loads last. Users see progressive content instead of waiting for everything.

### Suspense Inside Server Components

Use React's `Suspense` directly inside server components to stream parts of the component as they become ready.

**When to use:** A single server component with multiple async child components that should stream independently. Keeps related UI in one component while allowing progressive rendering.

```tsx
async function SlowMetric({ label, delay }: { label: string; delay: number }) {
  await new Promise((resolve) => setTimeout(resolve, delay))
  const value = await db.metrics.get(label)

  return (
    <div className="metric">
      <span>{label}</span>
      <span>{value.toLocaleString()}</span>
    </div>
  )
}

const getAnalyticsDashboard = createServerFn().handler(() =>
  renderServerComponent(
    <div className="dashboard">
      <h1>Analytics</h1>

      <div className="metrics-grid">
        <Suspense fallback={<MetricSkeleton label="Active Users" />}>
          <SlowMetric label="Active Users" delay={500} />
        </Suspense>

        <Suspense fallback={<MetricSkeleton label="Revenue" />}>
          <SlowMetric label="Revenue" delay={1500} />
        </Suspense>

        <Suspense fallback={<MetricSkeleton label="Conversion" />}>
          <SlowMetric label="Conversion" delay={2500} />
        </Suspense>
      </div>
    </div>,
  ),
)
```

Each metric streams independently. The dashboard shell appears immediately, then metrics pop in as their data loads.

### Streaming with Async Generators

Use async generators to stream server components one at a time. The client receives and renders each component as it's yielded.

**When to use:** Unbounded or large result sets where items should render incrementally. Useful when processing time per item varies or total count is unknown upfront.

```tsx
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'

const streamNotifications = createServerFn().handler(async function* () {
  // Yield initial batch immediately
  const recent = await db.notifications.getRecent(3)
  for (const notification of recent) {
    yield await createCompositeComponent<{
      renderActions?: (data: { id: string }) => React.ReactNode
    }>((props) => (
      <div className="notification">
        <h3>{notification.title}</h3>
        <p>{notification.message}</p>
        {props.renderActions?.({ id: notification.id })}
      </div>
    ))
  }

  // Stream older notifications with delays
  const older = await db.notifications.getOlder(5)
  for (const notification of older) {
    await new Promise((resolve) => setTimeout(resolve, 300))
    yield await createCompositeComponent<{
      renderActions?: (data: { id: string }) => React.ReactNode
    }>((props) => (
      <div className="notification">
        <h3>{notification.title}</h3>
        <p>{notification.message}</p>
        {props.renderActions?.({ id: notification.id })}
      </div>
    ))
  }
})

export const Route = createFileRoute('/notifications')({
  component: NotificationsPage,
})

function NotificationsPage() {
  const [notifications, setNotifications] = React.useState<Array<unknown>>([])
  const [isStreaming, setIsStreaming] = React.useState(false)

  const startStreaming = React.useCallback(async () => {
    setNotifications([])
    setIsStreaming(true)

    const stream = await streamNotifications()
    for await (const notification of stream) {
      setNotifications((prev) => [...prev, notification])
    }

    setIsStreaming(false)
  }, [])

  return (
    <div>
      <button onClick={startStreaming} disabled={isStreaming}>
        {isStreaming ? 'Streaming...' : 'Load Notifications'}
      </button>

      {notifications.map((notificationSrc, i) => (
        <CompositeComponent
          key={i}
          src={notificationSrc}
          renderActions={({ id }) => (
            <button onClick={() => markAsRead(id)}>Mark read</button>
          )}
        />
      ))}
    </div>
  )
}
```

Notifications appear one by one. The first three show immediately, then more stream in. Each supports client interactivity through render props.

## Error Handling

Errors in Server Components—whether during data fetching or rendering—propagate to the client.

### Route Level Errors

If a Server Component fails to load in the `loader`, the route's `errorComponent` renders:

```tsx
export const Route = createFileRoute('/')({
  loader: async () => ({
    // If this fails, the errorComponent renders
    Greeting: await getGreeting(),
  }),
  errorComponent: ({ error }) => <div>Failed to load: {error.message}</div>,
  component: HomePage,
})
```

### Component Level Errors

To isolate errors (e.g., preventing a single failing widget from crashing the page), you must use **[Deferred Loading](#deferred-component-loading)**.

By returning a Promise from the loader instead of awaiting it, the Route Component renders immediately. If the Promise later rejects, the `ErrorBoundary` inside your component catches it.

```tsx
// 1. Loader returns a Promise (don't await!)
export const Route = createFileRoute('/dashboard')({
  loader: () => ({
    // If this fails, only the specific ErrorBoundary below catches it
    WidgetPromise: getWidget(),
  }),
  component: DashboardPage,
})

// 2. Component handles the potential failure
function DashboardPage() {
  const { WidgetPromise } = Route.useLoaderData()

  return (
    <ErrorBoundary fallback={<div>Widget unavailable</div>}>
      <React.Suspense fallback={<Skeleton />}>
        <Deferred promise={WidgetPromise} />
      </React.Suspense>
    </ErrorBoundary>
  )
}
```

## Tips

### Using `React.cache`

`React.cache` works inside server components for request-scoped memoization. This is useful when multiple components need the same expensive computation:

```tsx
import { cache } from 'react'

const getUser = cache(async (userId: string) => {
  return db.users.findById(userId)
})

// Both components share the same cached result within a single request
async function UserHeader() {
  const user = await getUser('123') // Fetches from DB
  return <h1>{user.name}</h1>
}

async function UserSidebar() {
  const user = await getUser('123') // Returns cached result
  return <aside>{user.bio}</aside>
}
```

### Router Links in Server Components

TanStack Router's `Link` component works inside server components. The link is serialized and hydrates on the client for client-side navigation:

```tsx
import { Link } from '@tanstack/react-router'

const getNavigation = createServerFn().handler(async () => {
  const pages = await db.pages.list()

  return renderServerComponent(
    <nav>
      {pages.map((page) => (
        <Link key={page.id} to="/pages/$pageId" params={{ pageId: page.id }}>
          {page.title}
        </Link>
      ))}
    </nav>,
  )
})
```

### CSS in Server Components

CSS Modules and global CSS imports work in server components. Styles are extracted and sent to the client:

```tsx
import styles from './Card.module.css'

const getCard = createServerFn().handler(async () => {
  return renderServerComponent(
    <div className={styles.card}>
      <h2 className={styles.title}>Server Rendered</h2>
    </div>,
  )
})
```

## Rules and Limitations

### Slots are opaque on the server

The server cannot inspect slot content. `React.Children.map()` and `cloneElement()` won't work on `props.children`:

```tsx
// Won't work - children is a placeholder on the server
createCompositeComponent((props: { children?: React.ReactNode }) => (
  <div>
    {React.Children.map(props.children, (child) =>
      React.cloneElement(child, { extra: 'prop' }),
    )}
  </div>
))

// Do this instead - use render props
createCompositeComponent<{
  renderItem?: (data: { extra: string }) => React.ReactNode
}>((props) => <div>{props.renderItem?.({ extra: 'prop' })}</div>)
```

### Render prop arguments must be serializable

Arguments passed to slots via render props and or components travel through React's Flight protocol. Use serializable values only: strings, numbers, booleans, null, plain objects, and arrays.

## How It Works

When a server component accesses slot props, it accesses a proxy:

- Reading `props.children` creates a placeholder for "whatever children the caller provides"
- Calling `props.renderFn(args)` creates a placeholder that records `args`

TanStack Start sends a React Flight stream with these placeholders. On the client, placeholders are replaced with the actual props you passed when rendering.

## Current Status

Server Components are experimental in TanStack Start and will remain so into early v1.

**Serialization:** Uses React's native Flight protocol. TanStack Start's custom serialization isn't available in server components yet. Primitives, Dates, and React elements work. Custom serialization coming in a future release.

**API:** The RSC helper APIs may see refinements.

Questions? [Open an issue](https://github.com/tanstack/router/issues) or join the [Discord](https://tlinz.com/discord).

## Low-Level Flight Stream APIs

For advanced use cases (custom streaming protocols, API route integration, external RSC-aware systems), TanStack Start exposes low-level Flight stream APIs. For most cases, prefer the high-level helpers which handle caching, streaming, and (for composites) slots automatically.

Import from `@tanstack/react-start/rsc`:

| Function                   | Available in          | Description                                        |
| -------------------------- | --------------------- | -------------------------------------------------- |
| `renderToReadableStream`   | server functions only | Renders React elements to a Flight stream          |
| `createFromFetch`          | Client                | Decodes a Flight stream from a `Promise<Response>` |
| `createFromReadableStream` | Client/SSR            | Decodes a Flight stream from a `ReadableStream`    |

`createFromFetch` is a convenience wrapper around `createFromReadableStream` that accepts a fetch promise directly and extracts the body stream internally.

### Example

```tsx
// src/routes/api/rsc.ts - API route with Flight stream
import { createAPIFileRoute } from '@tanstack/react-start/api'
import { createServerFn } from '@tanstack/react-start'
import { renderToReadableStream } from '@tanstack/react-start/rsc'

const getFlightStream = createServerFn({ method: 'GET' }).handler(async () => {
  return renderToReadableStream(<div>Server Rendered Content</div>)
})

export const APIRoute = createAPIFileRoute('/api/rsc')({
  GET: async () => {
    const stream = await getFlightStream()
    return new Response(stream, {
      headers: { 'Content-Type': 'text/x-component' },
    })
  },
})
```

```tsx
// Client: fetch and decode the Flight stream
import { createFromFetch } from '@tanstack/react-start/rsc'

async function fetchRSC() {
  return createFromFetch(fetch('/api/rsc'))
}
```
