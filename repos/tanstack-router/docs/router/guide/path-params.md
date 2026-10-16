---
title: Path Params
---

Path params are used to match a single segment (the text until the next `/`) and provide its value back to you as a **named** variable. They are defined by using the `$` character prefix in the path, followed by the key variable to assign it to. The following are valid path param paths:

- `$postId`
- `$name`
- `$teamId`
- `about/$name`
- `team/$teamId`
- `blog/$postId`

Because path param routes only match to the next `/`, child routes can be created to continue expressing hierarchy:

Let's create a post route file that uses a path param to match the post ID:

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts.$postId.tsx"
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    return fetchPost(params.postId)
  },
})
```

# Solid

```tsx title="src/routes/posts.$postId.tsx"
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    return fetchPost(params.postId)
  },
})
```

<!-- ::end:framework -->

## Path Params can be used by child routes

Once a path param has been parsed, it is available to all child routes. This means that if we define a child route to our `postRoute`, we can use the `postId` variable from the URL in the child route's path!

## Path Params in Loaders

Path params are passed to the loader as a `params` object. The keys of this object are the names of the path params, and the values are the values that were parsed out of the actual URL path. For example, if we were to visit the `/blog/123` URL, the `params` object would be `{ postId: '123' }`:

```tsx title="src/routes/posts.$postId.tsx"
export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => {
    return fetchPost(params.postId)
  },
})
```

The `params` object is also passed to the `beforeLoad` option:

```tsx title="src/routes/posts.$postId.tsx"
export const Route = createFileRoute('/posts/$postId')({
  beforeLoad: async ({ params }) => {
    // do something with params.postId
  },
})
```

## Path Params in Components

If we add a component to our `postRoute`, we can access the `postId` variable from the URL by using the route's `useParams` hook:

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts.$postId.tsx"
export const Route = createFileRoute('/posts/$postId')({
  component: PostComponent,
})

function PostComponent() {
  const { postId } = Route.useParams()
  return <div>Post {postId}</div>
}
```

# Solid

```tsx title="src/routes/posts.$postId.tsx"
export const Route = createFileRoute('/posts/$postId')({
  component: PostComponent,
})

function PostComponent() {
  const params = Route.useParams()
  return <div>Post {params().postId}</div>
}
```

<!-- ::end:framework -->

> 🧠 Quick tip: If your component is code-split, you can use the [getRouteApi function](./code-splitting.md#manually-accessing-route-apis-in-other-files-with-the-getrouteapi-helper) to avoid having to import the `Route` configuration to get access to the typed `useParams()` hook.

## Path Params outside of Routes

You can also use the globally exported `useParams` hook to access any parsed path params from any component in your app. You'll need to pass the `strict: false` option to `useParams`, denoting that you want to access the params from an ambiguous location:

<!-- ::start:framework -->

# React

```tsx title="src/components/PostComponent.tsx"
function PostComponent() {
  const { postId } = useParams({ strict: false })
  return <div>Post {postId}</div>
}
```

# Solid

```tsx title="src/components/PostComponent.tsx"
function PostComponent() {
  const params = useParams({ strict: false })
  return <div>Post {params().postId}</div>
}
```

<!-- ::end:framework -->

## Prioritizing Parsed Path Param Routes

When multiple dynamic, optional, or wildcard routes can match the same URL, routes with `params.parse` are tried before equivalent routes without it. If multiple matching candidates use `params.parse`, you can use `params.priority` to control which candidate is tried first.

Higher `params.priority` values are tried first. The default priority is `0`, and if a higher-priority route's `params.parse` returns `false`, matching continues to the next candidate route.

```tsx title="src/routes/posts.$postId.tsx"
export const Route = createFileRoute('/posts/$postId')({
  params: {
    priority: 10,
    parse: ({ postId }) => {
      if (!/^\d+$/.test(postId)) return false
      return { postId: Number(postId) }
    },
    stringify: ({ postId }) => ({ postId: String(postId) }),
  },
})
```

With a fallback `/posts/$slug` route, `/posts/123` can match the parsed numeric route first, while `/posts/hello-world` can fall through to the slug route when `params.parse` returns `false`.

`params.priority` only affects competing candidates that use `params.parse`. It does not override normal route specificity, so static routes still match before dynamic, optional, or wildcard routes.

## Navigating with Path Params

When navigating to a route with path params, TypeScript will require you to pass the params either as an object or as a function that returns an object of params.

Let's see what an object style looks like:

```tsx
function Component() {
  return (
    <Link to="/blog/$postId" params={{ postId: '123' }}>
      Post 123
    </Link>
  )
}
```

And here's what a function style looks like:

```tsx
function Component() {
  return (
    <Link to="/blog/$postId" params={(prev) => ({ ...prev, postId: '123' })}>
      Post 123
    </Link>
  )
}
```

Notice that the function style is useful when you need to persist params that are already in the URL for other routes. This is because the function style will receive the current params as an argument, allowing you to modify them as needed and return the final params object.

## Prefixes and Suffixes for Path Params

You can also use **prefixes** and **suffixes** with path params to create more complex routing patterns. This allows you to match specific URL structures while still capturing the dynamic segments.

When using either prefixes or suffixes, you can define them by wrapping the path param in curly braces `{}` and placing the prefix or suffix before or after the variable name.

### Defining Prefixes

Prefixes are defined by placing the prefix text outside the curly braces before the variable name. For example, if you want to match a URL that starts with `post-` followed by a post ID, you can define it like this:

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts/post-{$postId}.tsx"
export const Route = createFileRoute('/posts/post-{$postId}')({
  component: PostComponent,
})

function PostComponent() {
  const { postId } = Route.useParams()
  // postId will be the value after 'post-'
  return <div>Post ID: {postId}</div>
}
```

# Solid

```tsx title="src/routes/posts/post-{$postId}.tsx"
export const Route = createFileRoute('/posts/post-{$postId}')({
  component: PostComponent,
})

function PostComponent() {
  const params = Route.useParams()
  // postId will be the value after 'post-'
  return <div>Post ID: {params().postId}</div>
}
```

<!-- ::end:framework -->

You can even combines prefixes with wildcard routes to create more complex patterns:

<!-- ::start:framework -->

# React

```tsx title="src/routes/on-disk/storage-{$postId}/$.tsx"
export const Route = createFileRoute('/on-disk/storage-{$postId}/$')({
  component: StorageComponent,
})

function StorageComponent() {
  const { _splat } = Route.useParams()
  // _splat, will be value after 'storage-'
  // i.e. my-drive/documents/foo.txt
  return <div>Storage Location: /{_splat}</div>
}
```

# Solid

```tsx title="src/routes/on-disk/storage-{$postId}/$.tsx"
export const Route = createFileRoute('/on-disk/storage-{$postId}/$')({
  component: StorageComponent,
})

function StorageComponent() {
  const params = Route.useParams()
  // _splat, will be value after 'storage-'
  // i.e. my-drive/documents/foo.txt
  return <div>Storage Location: /{params()._splat}</div>
}
```

<!-- ::end:framework -->

### Defining Suffixes

Suffixes are defined by placing the suffix text outside the curly braces after the variable name. For example, if you want to match a URL a filename that ends with `txt`, you can define it like this:

<!-- ::start:framework -->

# React

```tsx title="src/routes/files/{$fileName}[.]txt.tsx"
export const Route = createFileRoute('/files/{$fileName}.txt')({
  component: FileComponent,
})

function FileComponent() {
  const { fileName } = Route.useParams()
  // fileName will be the value before 'txt'
  return <div>File Name: {fileName}</div>
}
```

# Solid

```tsx title="src/routes/files/{$fileName}[.]txt.tsx"
export const Route = createFileRoute('/files/{$fileName}.txt')({
  component: FileComponent,
})

function FileComponent() {
  const params = Route.useParams()
  // fileName will be the value before 'txt'
  return <div>File Name: {params().fileName}</div>
}
```

<!-- ::end:framework -->

You can also combine suffixes with wildcards for more complex routing patterns:

<!-- ::start:framework -->

# React

```tsx title="src/routes/files/{$}[.]txt.tsx"
export const Route = createFileRoute('/files/{$}.txt')({
  component: FileComponent,
})

function FileComponent() {
  const { _splat } = Route.useParams()
  // _splat will be the value before '.txt'
  return <div>File Splat: {_splat}</div>
}
```

# Solid

```tsx title="src/routes/files/{$}[.]txt.tsx"
export const Route = createFileRoute('/files/{$}.txt')({
  component: FileComponent,
})

function FileComponent() {
  const params = Route.useParams()
  // _splat will be the value before '.txt'
  return <div>File Splat: {params()._splat}</div>
}
```

<!-- ::end:framework -->

### Combining Prefixes and Suffixes

You can combine both prefixes and suffixes to create very specific routing patterns. For example, if you want to match a URL that starts with `user-` and ends with `.json`, you can define it like this:

<!-- ::start:framework -->

# React

```tsx title="src/routes/users/user-{$userId}[.]json.tsx"
export const Route = createFileRoute('/users/user-{$userId}.json')({
  component: UserComponent,
})

function UserComponent() {
  const { userId } = Route.useParams()
  // userId will be the value between 'user-' and '.json'
  return <div>User ID: {userId}</div>
}
```

# Solid

```tsx title="src/routes/users/user-{$userId}[.]json.tsx"
export const Route = createFileRoute('/users/user-{$userId}.json')({
  component: UserComponent,
})

function UserComponent() {
  const params = Route.useParams()
  // userId will be the value between 'user-' and '.json'
  return <div>User ID: {params().userId}</div>
}
```

<!-- ::end:framework -->

Similar to the previous examples, you can also use wildcards with prefixes and suffixes. Go wild!

## Optional Path Parameters

Optional path parameters allow you to define route segments that may or may not be present in the URL. They use the `{-$paramName}` syntax and provide flexible routing patterns where certain parameters are optional.

### Defining Optional Parameters

Optional path parameters are defined using curly braces with a dash prefix: `{-$paramName}`

```tsx
// Single optional parameter
// src/routes/posts/{-$category}.tsx
export const Route = createFileRoute('/posts/{-$category}')({
  component: PostsComponent,
})

// Multiple optional parameters
// src/routes/posts/{-$category}/{-$slug}.tsx
export const Route = createFileRoute('/posts/{-$category}/{-$slug}')({
  component: PostComponent,
})

// Mixed required and optional parameters
// src/routes/users/$id/{-$tab}.tsx
export const Route = createFileRoute('/users/$id/{-$tab}')({
  component: UserComponent,
})
```

### How Optional Parameters Work

Optional parameters create flexible URL patterns:

- `/posts/{-$category}` matches both `/posts` and `/posts/tech`
- `/posts/{-$category}/{-$slug}` matches `/posts`, `/posts/tech`, and `/posts/tech/hello-world`
- `/users/$id/{-$tab}` matches `/users/123` and `/users/123/settings`

When an optional parameter is not present in the URL, its value will be `undefined` in your route handlers and components.

### Accessing Optional Parameters

Optional parameters work exactly like regular parameters in your components, but their values may be `undefined`:

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts/{-$category}.tsx"
function PostsComponent() {
  const { category } = Route.useParams()

  return <div>{category ? `Posts in ${category}` : 'All Posts'}</div>
}
```

# Solid

```tsx title="src/routes/posts/{-$category}.tsx"
function PostsComponent() {
  const params = Route.useParams()

  return (
    <div>
      {params().category ? `Posts in ${params().category}` : 'All Posts'}
    </div>
  )
}
```

<!-- ::end:framework -->

### Optional Parameters in Loaders

Optional parameters are available in loaders and may be `undefined`:

```tsx
export const Route = createFileRoute('/posts/{-$category}')({
  loader: async ({ params }) => {
    // params.category might be undefined
    return fetchPosts({ category: params.category })
  },
})
```

### Optional Parameters in beforeLoad

Optional parameters work in `beforeLoad` handlers as well:

```tsx
export const Route = createFileRoute('/posts/{-$category}')({
  beforeLoad: async ({ params }) => {
    if (params.category) {
      // Validate category exists
      await validateCategory(params.category)
    }
  },
})
```

### Advanced Optional Parameter Patterns

#### With Prefix and Suffix

Optional parameters support prefix and suffix patterns:

<!-- ::start:framework -->

# React

```tsx title="src/routes/files/prefix{-$name}[.]txt.tsx"
// Route: /files/prefix{-$name}.txt
// Matches: /files/prefix.txt and /files/prefixdocument.txt
export const Route = createFileRoute('/files/prefix{-$name}.txt')({
  component: FileComponent,
})

function FileComponent() {
  const { name } = Route.useParams()
  return <div>File: {name || 'default'}</div>
}
```

# Solid

```tsx title="src/routes/files/prefix{-$name}[.]txt.tsx"
// Route: /files/prefix{-$name}.txt
// Matches: /files/prefix.txt and /files/prefixdocument.txt
export const Route = createFileRoute('/files/prefix{-$name}.txt')({
  component: FileComponent,
})

function FileComponent() {
  const params = Route.useParams()
  return <div>File: {params().name || 'default'}</div>
}
```

<!-- ::end:framework -->

#### All Optional Parameters

You can create routes where all parameters are optional:

<!-- ::start:framework -->

# React

```tsx title="src/routes/{-$year}/{-$month}/{-$day}.tsx"
// Route: /{-$year}/{-$month}/{-$day}
// Matches: /, /2023, /2023/12, /2023/12/25
export const Route = createFileRoute('/{-$year}/{-$month}/{-$day}')({
  component: DateComponent,
})

function DateComponent() {
  const { year, month, day } = Route.useParams()

  if (!year) return <div>Select a year</div>
  if (!month) return <div>Year: {year}</div>
  if (!day)
    return (
      <div>
        Month: {year}/{month}
      </div>
    )

  return (
    <div>
      Date: {year}/{month}/{day}
    </div>
  )
}
```

# Solid

```tsx title="src/routes/{-$year}/{-$month}/{-$day}.tsx"
// Route: /{-$year}/{-$month}/{-$day}
// Matches: /, /2023, /2023/12, /2023/12/25
export const Route = createFileRoute('/{-$year}/{-$month}/{-$day}')({
  component: DateComponent,
})

function DateComponent() {
  const params = Route.useParams()

  if (!params().year) return <div>Select a year</div>
  if (!params().month) return <div>Year: {params().year}</div>
  if (!params().day)
    return (
      <div>
        Month: {params().year}/{params().month}
      </div>
    )

  return (
    <div>
      Date: {params().year}/{params().month}/{params().day}
    </div>
  )
}
```

<!-- ::end:framework -->

#### Optional Parameters with Wildcards

Optional parameters can be combined with wildcards for complex routing patterns:

<!-- ::start:framework -->

# React

```tsx title="src/routes/docs/{-$version}/$.tsx"
// Route: /docs/{-$version}/$
// Matches: /docs/extra/path, /docs/v2/extra/path
export const Route = createFileRoute('/docs/{-$version}/$')({
  component: DocsComponent,
})

function DocsComponent() {
  const { version } = Route.useParams()
  const { _splat } = Route.useParams()

  return (
    <div>
      Version: {version || 'latest'}
      Path: {_splat}
    </div>
  )
}
```

# Solid

```tsx title="src/routes/docs/{-$version}/$.tsx"
// Route: /docs/{-$version}/$
// Matches: /docs/extra/path, /docs/v2/extra/path
export const Route = createFileRoute('/docs/{-$version}/$')({
  component: DocsComponent,
})

function DocsComponent() {
  const params = Route.useParams()

  return (
    <div>
      Version: {params().version || 'latest'}
      Path: {params()._splat}
    </div>
  )
}
```

<!-- ::end:framework -->

### Navigating with Optional Parameters

When navigating to routes with optional parameters, you have fine-grained control over which parameters to include:

```tsx
function Navigation() {
  return (
    <div>
      {/* Navigate with optional parameter */}
      <Link to="/posts/{-$category}" params={{ category: 'tech' }}>
        Tech Posts
      </Link>

      {/* Navigate without optional parameter */}
      <Link to="/posts/{-$category}" params={{ category: undefined }}>
        All Posts
      </Link>

      {/* Navigate with multiple optional parameters */}
      <Link
        to="/posts/{-$category}/{-$slug}"
        params={{ category: 'tech', slug: 'react-tips' }}
      >
        Specific Post
      </Link>
    </div>
  )
}
```

### Type Safety with Optional Parameters

TypeScript provides full type safety for optional parameters:

<!-- ::start:framework -->

# React

```tsx title="src/routes/posts/{-$category}.tsx"
function PostsComponent() {
  // TypeScript knows category might be undefined
  const { category } = Route.useParams() // category: string | undefined

  // Safe navigation
  const categoryUpper = category?.toUpperCase()

  return <div>{categoryUpper || 'All Categories'}</div>
}

// Navigation is type-safe and flexible
<Link
  to="/posts/{-$category}"
  params={{ category: 'tech' }} // ✅ Valid - string
>
  Tech Posts
</Link>

<Link
  to="/posts/{-$category}"
  params={{ category: 123 }} // ✅ Valid - number (auto-stringified)
>
  Category 123
</Link>
```

# Solid

```tsx title="src/routes/posts/{-$category}.tsx"
function PostsComponent() {
  // TypeScript knows category might be undefined
  const params = Route.useParams() // category: string | undefined

  // Safe navigation
  const categoryUpper = params().category?.toUpperCase()

  return <div>{categoryUpper || 'All Categories'}</div>
}

// Navigation is type-safe and flexible
<Link
  to="/posts/{-$category}"
  params={{ category: 'tech' }} // ✅ Valid - string
>
  Tech Posts
</Link>

<Link
  to="/posts/{-$category}"
  params={{ category: 123 }} // ✅ Valid - number (auto-stringified)
>
  Category 123
</Link>
```

<!-- ::end:framework -->

## Internationalization (i18n) with Optional Path Parameters

Optional path parameters are excellent for implementing internationalization (i18n) routing patterns. You can use prefix patterns to handle multiple languages while maintaining clean, SEO-friendly URLs.

### Prefix-based i18n

Use optional language prefixes to support URLs like `/en/about`, `/fr/about`, or just `/about` (default language):

<!-- ::start:framework -->

# React

```tsx title="src/routes/{-$locale}/about.tsx"
// Route: /{-$locale}/about
export const Route = createFileRoute('/{-$locale}/about')({
  component: AboutComponent,
})

function AboutComponent() {
  const { locale } = Route.useParams()
  const currentLocale = locale || 'en' // Default to English

  const content = {
    en: { title: 'About Us', description: 'Learn more about our company.' },
    fr: {
      title: 'À Propos',
      description: 'En savoir plus sur notre entreprise.',
    },
    es: {
      title: 'Acerca de',
      description: 'Conoce más sobre nuestra empresa.',
    },
  }

  return (
    <div>
      <h1>{content[currentLocale]?.title}</h1>
      <p>{content[currentLocale]?.description}</p>
    </div>
  )
}
```

# Solid

```tsx title="src/routes/{-$locale}/about.tsx"
// Route: /{-$locale}/about
export const Route = createFileRoute('/{-$locale}/about')({
  component: AboutComponent,
})

function AboutComponent() {
  const params = Route.useParams()
  const currentLocale = params().locale || 'en' // Default to English

  const content = {
    en: { title: 'About Us', description: 'Learn more about our company.' },
    fr: {
      title: 'À Propos',
      description: 'En savoir plus sur notre entreprise.',
    },
    es: {
      title: 'Acerca de',
      description: 'Conoce más sobre nuestra empresa.',
    },
  }

  return (
    <div>
      <h1>{content[currentLocale]?.title}</h1>
      <p>{content[currentLocale]?.description}</p>
    </div>
  )
}
```

<!-- ::end:framework -->

This pattern matches:

- `/about` (default locale)
- `/en/about` (explicit English)
- `/fr/about` (French)
- `/es/about` (Spanish)

### Complex i18n Patterns

Combine optional parameters for more sophisticated i18n routing:

<!-- ::start:framework -->

# React

```tsx title="src/routes/{-$locale}/blog/{-$category}/$slug.tsx"
// Route: /{-$locale}/blog/{-$category}/$slug
export const Route = createFileRoute('/{-$locale}/blog/{-$category}/$slug')({
  beforeLoad: async ({ params }) => {
    const locale = params.locale || 'en'
    const category = params.category

    // Validate locale and category
    const validLocales = ['en', 'fr', 'es', 'de']
    if (locale && !validLocales.includes(locale)) {
      throw new Error('Invalid locale')
    }

    return { locale, category }
  },
  loader: async ({ params, context }) => {
    const { locale } = context
    const { slug, category } = params

    return fetchBlogPost({ slug, category, locale })
  },
  component: BlogPostComponent,
})

function BlogPostComponent() {
  const { locale, category, slug } = Route.useParams()
  const data = Route.useLoaderData()

  return (
    <article>
      <h1>{data.title}</h1>
      <p>
        Category: {category || 'All'} | Language: {locale || 'en'}
      </p>
      <div>{data.content}</div>
    </article>
  )
}
```

# Solid

```tsx title="src/routes/{-$locale}/blog/{-$category}/$slug.tsx"
// Route: /{-$locale}/blog/{-$category}/$slug
export const Route = createFileRoute('/{-$locale}/blog/{-$category}/$slug')({
  beforeLoad: async ({ params }) => {
    const locale = params.locale || 'en'
    const category = params.category

    // Validate locale and category
    const validLocales = ['en', 'fr', 'es', 'de']
    if (locale && !validLocales.includes(locale)) {
      throw new Error('Invalid locale')
    }

    return { locale, category }
  },
  loader: async ({ params, context }) => {
    const { locale } = context
    const { slug, category } = params

    return fetchBlogPost({ slug, category, locale })
  },
  component: BlogPostComponent,
})

function BlogPostComponent() {
  const params = Route.useParams()
  const data = Route.useLoaderData()

  return (
    <article>
      <h1>{data.title}</h1>
      <p>
        Category: {params().category || 'All'} | Language:{' '}
        {params().locale || 'en'}
      </p>
      <div>{data.content}</div>
    </article>
  )
}
```

<!-- ::end:framework -->

This supports URLs like:

- `/blog/tech/my-post` (default locale, tech category)
- `/fr/blog/my-post` (French, no category)
- `/en/blog/tech/my-post` (explicit English, tech category)
- `/es/blog/tecnologia/mi-post` (Spanish, Spanish category)

### Language Navigation

Create language switchers using optional i18n parameters with function-style params:

<!-- ::start:framework -->

# React

```tsx title="src/components/LanguageSwitcher.tsx"
function LanguageSwitcher() {
  const currentParams = useParams({ strict: false })

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
  ]

  return (
    <div className="language-switcher">
      {languages.map(({ code, name }) => (
        <Link
          key={code}
          to="/{-$locale}/blog/{-$category}/$slug"
          params={(prev) => ({
            ...prev,
            locale: code === 'en' ? undefined : code, // Remove 'en' for clean URLs
          })}
          className={currentParams.locale === code ? 'active' : ''}
        >
          {name}
        </Link>
      ))}
    </div>
  )
}
```

# Solid

```tsx title="src/components/LanguageSwitcher.tsx"
function LanguageSwitcher() {
  const currentParams = useParams({ strict: false })

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
  ]

  return (
    <div class="language-switcher">
      {languages.map(({ code, name }) => (
        <Link
          to="/{-$locale}/blog/{-$category}/$slug"
          params={(prev) => ({
            ...prev,
            locale: code === 'en' ? undefined : code, // Remove 'en' for clean URLs
          })}
          class={currentParams().locale === code ? 'active' : ''}
        >
          {name}
        </Link>
      ))}
    </div>
  )
}
```

<!-- ::end:framework -->

You can also create more sophisticated language switching logic:

<!-- ::start:framework -->

# React

```tsx
function AdvancedLanguageSwitcher() {
  const currentParams = useParams({ strict: false })

  const handleLanguageChange = (newLocale: string) => {
    return (prev: any) => {
      // Preserve all existing params but update locale
      const updatedParams = { ...prev }

      if (newLocale === 'en') {
        // Remove locale for clean English URLs
        delete updatedParams.locale
      } else {
        updatedParams.locale = newLocale
      }

      return updatedParams
    }
  }

  return (
    <div className="language-switcher">
      <Link
        to="/{-$locale}/blog/{-$category}/$slug"
        params={handleLanguageChange('fr')}
      >
        Français
      </Link>

      <Link
        to="/{-$locale}/blog/{-$category}/$slug"
        params={handleLanguageChange('es')}
      >
        Español
      </Link>

      <Link
        to="/{-$locale}/blog/{-$category}/$slug"
        params={handleLanguageChange('en')}
      >
        English
      </Link>
    </div>
  )
}
```

# Solid

```tsx
function AdvancedLanguageSwitcher() {
  const currentParams = useParams({ strict: false })

  const handleLanguageChange = (newLocale: string) => {
    return (prev: any) => {
      // Preserve all existing params but update locale
      const updatedParams = { ...prev }

      if (newLocale === 'en') {
        // Remove locale for clean English URLs
        delete updatedParams.locale
      } else {
        updatedParams.locale = newLocale
      }

      return updatedParams
    }
  }

  return (
    <div class="language-switcher">
      <Link
        to="/{-$locale}/blog/{-$category}/$slug"
        params={handleLanguageChange('fr')}
      >
        Français
      </Link>

      <Link
        to="/{-$locale}/blog/{-$category}/$slug"
        params={handleLanguageChange('es')}
      >
        Español
      </Link>

      <Link
        to="/{-$locale}/blog/{-$category}/$slug"
        params={handleLanguageChange('en')}
      >
        English
      </Link>
    </div>
  )
}
```

<!-- ::end:framework -->

### Advanced i18n with Optional Parameters

Organize i18n routes using optional parameters for flexible locale handling:

<!-- ::start:framework -->

# React

```tsx
// Route structure:
// routes/
//   {-$locale}/
//     index.tsx        // /, /en, /fr
//     about.tsx        // /about, /en/about, /fr/about
//     blog/
//       index.tsx      // /blog, /en/blog, /fr/blog
//       $slug.tsx      // /blog/post, /en/blog/post, /fr/blog/post

// routes/{-$locale}/index.tsx
export const Route = createFileRoute('/{-$locale}/')({
  component: HomeComponent,
})

function HomeComponent() {
  const { locale } = Route.useParams()
  const isRTL = ['ar', 'he', 'fa'].includes(locale || '')

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <h1>Welcome ({locale || 'en'})</h1>
      {/* Localized content */}
    </div>
  )
}

// routes/{-$locale}/about.tsx
export const Route = createFileRoute('/{-$locale}/about')({
  component: AboutComponent,
})
```

# Solid

```tsx
// Route structure:
// routes/
//   {-$locale}/
//     index.tsx        // /, /en, /fr
//     about.tsx        // /about, /en/about, /fr/about
//     blog/
//       index.tsx      // /blog, /en/blog, /fr/blog
//       $slug.tsx      // /blog/post, /en/blog/post, /fr/blog/post

// routes/{-$locale}/index.tsx
export const Route = createFileRoute('/{-$locale}/')({
  component: HomeComponent,
})

function HomeComponent() {
  const params = Route.useParams()
  const isRTL = ['ar', 'he', 'fa'].includes(params().locale || '')

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <h1>Welcome ({params().locale || 'en'})</h1>
      {/* Localized content */}
    </div>
  )
}

// routes/{-$locale}/about.tsx
export const Route = createFileRoute('/{-$locale}/about')({
  component: AboutComponent,
})
```

<!-- ::end:framework -->

### SEO and Canonical URLs

Handle SEO for i18n routes properly:

<!-- ::start:framework -->

# React

```tsx title="src/routes/{-$locale}/products/$id.tsx"
export const Route = createFileRoute('/{-$locale}/products/$id')({
  component: ProductComponent,
  head: ({ params, loaderData }) => {
    const locale = params.locale || 'en'
    const product = loaderData

    return {
      title: product.title[locale] || product.title.en,
      meta: [
        {
          name: 'description',
          content: product.description[locale] || product.description.en,
        },
        {
          property: 'og:locale',
          content: locale,
        },
      ],
      links: [
        // Canonical URL (always use default locale format)
        {
          rel: 'canonical',
          href: `https://example.com/products/${params.id}`,
        },
        // Alternate language versions
        {
          rel: 'alternate',
          hreflang: 'en',
          href: `https://example.com/products/${params.id}`,
        },
        {
          rel: 'alternate',
          hreflang: 'fr',
          href: `https://example.com/fr/products/${params.id}`,
        },
        {
          rel: 'alternate',
          hreflang: 'es',
          href: `https://example.com/es/products/${params.id}`,
        },
      ],
    }
  },
})
```

# Solid

```tsx title="src/routes/{-$locale}/products/$id.tsx"
export const Route = createFileRoute('/{-$locale}/products/$id')({
  component: ProductComponent,
  head: ({ params, loaderData }) => {
    const locale = params.locale || 'en'
    const product = loaderData

    return {
      title: product.title[locale] || product.title.en,
      meta: [
        {
          name: 'description',
          content: product.description[locale] || product.description.en,
        },
        {
          property: 'og:locale',
          content: locale,
        },
      ],
      links: [
        // Canonical URL (always use default locale format)
        {
          rel: 'canonical',
          href: `https://example.com/products/${params.id}`,
        },
        // Alternate language versions
        {
          rel: 'alternate',
          hreflang: 'en',
          href: `https://example.com/products/${params.id}`,
        },
        {
          rel: 'alternate',
          hreflang: 'fr',
          href: `https://example.com/fr/products/${params.id}`,
        },
        {
          rel: 'alternate',
          hreflang: 'es',
          href: `https://example.com/es/products/${params.id}`,
        },
      ],
    }
  },
})
```

<!-- ::end:framework -->

### Type Safety for i18n

Ensure type safety for your i18n implementations:

<!-- ::start:framework -->

# React

```tsx title="src/routes/{-$locale}/shop/{-$category}.tsx"
// Define supported locales
type Locale = 'en' | 'fr' | 'es' | 'de'

// Type-safe locale validation
function validateLocale(locale: string | undefined): locale is Locale {
  return ['en', 'fr', 'es', 'de'].includes(locale as Locale)
}

export const Route = createFileRoute('/{-$locale}/shop/{-$category}')({
  beforeLoad: async ({ params }) => {
    const { locale } = params

    // Type-safe locale validation
    if (locale && !validateLocale(locale)) {
      throw redirect({
        to: '/shop/{-$category}',
        params: { category: params.category },
      })
    }

    return {
      locale: (locale as Locale) || 'en',
      isDefaultLocale: !locale || locale === 'en',
    }
  },
  component: ShopComponent,
})

function ShopComponent() {
  const { locale, category } = Route.useParams()
  const { isDefaultLocale } = Route.useRouteContext()

  // TypeScript knows locale is Locale | undefined
  // and we have validated it in beforeLoad

  return (
    <div>
      <h1>Shop {category ? `- ${category}` : ''}</h1>
      <p>Language: {locale || 'en'}</p>
      {!isDefaultLocale && (
        <Link to="/shop/{-$category}" params={{ category }}>
          View in English
        </Link>
      )}
    </div>
  )
}
```

# Solid

```tsx title="src/routes/{-$locale}/shop/{-$category}.tsx"
// Define supported locales
type Locale = 'en' | 'fr' | 'es' | 'de'

// Type-safe locale validation
function validateLocale(locale: string | undefined): locale is Locale {
  return ['en', 'fr', 'es', 'de'].includes(locale as Locale)
}

export const Route = createFileRoute('/{-$locale}/shop/{-$category}')({
  beforeLoad: async ({ params }) => {
    const { locale } = params

    // Type-safe locale validation
    if (locale && !validateLocale(locale)) {
      throw redirect({
        to: '/shop/{-$category}',
        params: { category: params.category },
      })
    }

    return {
      locale: (locale as Locale) || 'en',
      isDefaultLocale: !locale || locale === 'en',
    }
  },
  component: ShopComponent,
})

function ShopComponent() {
  const params = Route.useParams()
  const routeContext = Route.useRouteContext()

  // TypeScript knows locale is Locale | undefined
  // and we have validated it in beforeLoad

  return (
    <div>
      <h1>Shop {params().category ? `- ${params().category}` : ''}</h1>
      <p>Language: {params().locale || 'en'}</p>
      {!routeContext().isDefaultLocale && (
        <Link to="/shop/{-$category}" params={{ category: params().category }}>
          View in English
        </Link>
      )}
    </div>
  )
}
```

<!-- ::end:framework -->

Optional path parameters provide a powerful and flexible foundation for implementing internationalization in your TanStack Router applications. Whether you prefer prefix-based or combined approaches, you can create clean, SEO-friendly URLs while maintaining excellent developer experience and type safety.

## Allowed Characters

By default, path params are escaped with `encodeURIComponent`. If you want to allow other valid URI characters (e.g. `@` or `+`), you can specify that in your [RouterOptions](../api/router/RouterOptionsType.md#pathparamsallowedcharacters-property).

Example usage:

```tsx
const router = createRouter({
  // ...
  pathParamsAllowedCharacters: ['@'],
})
```

The following is the list of accepted allowed characters:

- `;`
- `:`
- `@`
- `&`
- `=`
- `+`
- `$`
- `,`
