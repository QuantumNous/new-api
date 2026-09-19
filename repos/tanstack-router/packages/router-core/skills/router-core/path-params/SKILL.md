---
name: router-core/path-params
description: >-
  Dynamic path segments ($paramName), splat routes ($ / _splat),
  optional params ({-$paramName}), prefix/suffix patterns ({$param}.ext),
  useParams, params.parse/stringify, pathParamsAllowedCharacters,
  i18n locale patterns.
type: sub-skill
library: tanstack-router
library_version: '1.166.2'
requires:
  - router-core
sources:
  - TanStack/router:docs/router/guide/path-params.md
  - TanStack/router:docs/router/routing/routing-concepts.md
  - TanStack/router:docs/router/guide/internationalization-i18n.md
---

# Path Params

Path params capture dynamic URL segments into named variables. They are defined with a `$` prefix in the route path.

> **CRITICAL**: Never interpolate params into the `to` string. Always use the `params` prop. This is the most common agent mistake for path params.

> **CRITICAL**: Types are fully inferred. Never annotate the return of `useParams()`.

## Dynamic Segments

A segment prefixed with `$` captures text until the next `/`.

```tsx
// src/routes/posts.$postId.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    // params.postId is string — fully inferred, do not annotate
    return fetchPost(params.postId)
  },
  component: PostComponent,
})

function PostComponent() {
  const { postId } = Route.useParams()
  const data = Route.useLoaderData()
  return (
    <h1>
      Post {postId}: {data.title}
    </h1>
  )
}
```

Multiple dynamic segments work across path levels:

```tsx
// src/routes/teams.$teamId.members.$memberId.tsx
export const Route = createFileRoute('/teams/$teamId/members/$memberId')({
  component: MemberComponent,
})

function MemberComponent() {
  const { teamId, memberId } = Route.useParams()
  return (
    <div>
      Team {teamId}, Member {memberId}
    </div>
  )
}
```

## Splat / Catch-All Routes

A route with a path ending in `$` (bare dollar sign) captures everything after it. The value is available under the `_splat` key.

```tsx
// src/routes/files.$.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/files/$')({
  component: FileViewer,
})

function FileViewer() {
  const { _splat } = Route.useParams()
  // URL: /files/documents/report.pdf → _splat = "documents/report.pdf"
  return <div>File path: {_splat}</div>
}
```

## Optional Params

Optional params use `{-$paramName}` syntax. The segment may or may not be present. When absent, the value is `undefined`.

```tsx
// src/routes/posts.{-$category}.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/{-$category}')({
  component: PostsComponent,
})

function PostsComponent() {
  const { category } = Route.useParams()
  // URL: /posts → category is undefined
  // URL: /posts/tech → category is "tech"
  return <div>{category ? `Posts in ${category}` : 'All Posts'}</div>
}
```

Multiple optional params:

```tsx
// Matches: /posts, /posts/tech, /posts/tech/hello-world
export const Route = createFileRoute('/posts/{-$category}/{-$slug}')({
  component: PostComponent,
})
```

### i18n with Optional Locale

```tsx
// src/routes/{-$locale}/about.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/{-$locale}/about')({
  component: AboutComponent,
})

function AboutComponent() {
  const { locale } = Route.useParams()
  const currentLocale = locale || 'en'
  return <h1>{currentLocale === 'fr' ? 'À Propos' : 'About Us'}</h1>
}
// Matches: /about, /en/about, /fr/about
```

## Prefix and Suffix Patterns

Curly braces `{}` around `$paramName` allow text before or after the dynamic part within a single segment.

### Prefix

```tsx
// src/routes/posts/post-{$postId}.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/post-{$postId}')({
  component: PostComponent,
})

function PostComponent() {
  const { postId } = Route.useParams()
  // URL: /posts/post-123 → postId = "123"
  return <div>Post ID: {postId}</div>
}
```

### Suffix

```tsx
// src/routes/files/{$fileName}[.]txt.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/files/{$fileName}.txt')({
  component: FileComponent,
})

function FileComponent() {
  const { fileName } = Route.useParams()
  // URL: /files/readme.txt → fileName = "readme"
  return <div>File: {fileName}.txt</div>
}
```

### Combined Prefix + Suffix

```tsx
// URL: /users/user-456.json → userId = "456"
export const Route = createFileRoute('/users/user-{$userId}.json')({
  component: UserComponent,
})

function UserComponent() {
  const { userId } = Route.useParams()
  return <div>User: {userId}</div>
}
```

## Navigating with Path Params

### Object Form

```tsx
import { Link } from '@tanstack/react-router'

function PostLink({ postId }: { postId: string }) {
  return (
    <Link to="/posts/$postId" params={{ postId }}>
      View Post
    </Link>
  )
}
```

### Function Form (Preserves Other Params)

```tsx
function PostLink({ postId }: { postId: string }) {
  return (
    <Link to="/posts/$postId" params={(prev) => ({ ...prev, postId })}>
      View Post
    </Link>
  )
}
```

### Programmatic Navigation

```tsx
import { useNavigate } from '@tanstack/react-router'

function GoToPost({ postId }: { postId: string }) {
  const navigate = useNavigate()

  return (
    <button
      onClick={() => {
        navigate({ to: '/posts/$postId', params: { postId } })
      }}
    >
      Go to Post
    </button>
  )
}
```

### Navigating with Optional Params

```tsx
// Include the optional param
<Link to="/posts/{-$category}" params={{ category: 'tech' }}>
  Tech Posts
</Link>

// Omit the optional param (renders /posts)
<Link to="/posts/{-$category}" params={{ category: undefined }}>
  All Posts
</Link>
```

## Reading Params Outside Route Components

### `useParams` with `from`

```tsx
import { useParams } from '@tanstack/react-router'

function PostHeader() {
  const { postId } = useParams({ from: '/posts/$postId' })
  return <h2>Post {postId}</h2>
}
```

### `useParams` with `strict: false`

```tsx
function GenericBreadcrumb() {
  const params = useParams({ strict: false })
  // params is a union of all possible route params
  return <span>{params.postId ?? 'Home'}</span>
}
```

## Params in Loaders and `beforeLoad`

```tsx
export const Route = createFileRoute('/posts/$postId')({
  beforeLoad: async ({ params }) => {
    // params.postId available here
    const canView = await checkPermission(params.postId)
    if (!canView) throw redirect({ to: '/unauthorized' })
  },
  loader: async ({ params }) => {
    return fetchPost(params.postId)
  },
})
```

## Allowed Characters

By default, params are encoded with `encodeURIComponent`. Allow extra characters via router config:

```tsx
import { createRouter } from '@tanstack/react-router'

const router = createRouter({
  routeTree,
  pathParamsAllowedCharacters: ['@', '+'],
})
```

Allowed characters: `;`, `:`, `@`, `&`, `=`, `+`, `$`, `,`.

## Common Mistakes

### 1. CRITICAL (cross-skill): Interpolating path params into `to` string

```tsx
// WRONG — breaks type safety and param encoding
<Link to={`/posts/${postId}`}>Post</Link>

// CORRECT — use params prop
<Link to="/posts/$postId" params={{ postId }}>Post</Link>
```

### 2. MEDIUM: Using `*` for splat routes instead of `$`

TanStack Router uses `$` for splat routes. The captured value is under `_splat`, not `*`.

```tsx
// WRONG (React Router / other frameworks)
// <Route path="/files/*" />

// CORRECT (TanStack Router)
// File: src/routes/files.$.tsx
export const Route = createFileRoute('/files/$')({
  component: () => {
    const { _splat } = Route.useParams()
    return <div>{_splat}</div>
  },
})
```

> Note: `*` works in v1 for backwards compatibility but will be removed in v2. Always use `_splat`.

### 3. MEDIUM: Using curly braces for basic dynamic segments

Curly braces are ONLY for prefix/suffix patterns and optional params. Basic dynamic segments use bare `$`.

```tsx
// WRONG — braces not needed for basic params
createFileRoute('/posts/{$postId}')

// CORRECT — bare $ for basic dynamic segments
createFileRoute('/posts/$postId')

// CORRECT — braces for prefix pattern
createFileRoute('/posts/post-{$postId}')

// CORRECT — braces for optional param
createFileRoute('/posts/{-$category}')
```

### 4. Params are always strings

Path params are always parsed as strings. If you need a number, parse in the loader or component:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    const id = parseInt(params.postId, 10)
    if (isNaN(id)) throw notFound()
    return fetchPost(id)
  },
})
```

You can also use `params.parse` and `params.stringify` on the route for bidirectional transformation:

```tsx
export const Route = createFileRoute('/posts/$postId')({
  params: {
    parse: (raw) => ({ postId: parseInt(raw.postId, 10) }),
    stringify: (parsed) => ({ postId: String(parsed.postId) }),
  },
  loader: async ({ params }) => {
    // params.postId is now number
    return fetchPost(params.postId)
  },
})
```
