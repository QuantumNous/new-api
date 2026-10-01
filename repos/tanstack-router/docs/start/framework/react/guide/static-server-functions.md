---
id: static-server-functions
title: Static Server Functions
---

> [!WARNING]
> Static Server Functions are experimental!

## What are Static Server Functions?

Static server functions are server functions that are executed at build time and cached as static assets when using prerendering/static-generation. They can be set to "static" mode by applying the `staticFunctionMiddleware` middleware to `createServerFn`:

```tsx
import { createServerFn } from '@tanstack/react-start'
import { staticFunctionMiddleware } from '@tanstack/start-static-server-functions'

const myServerFn = createServerFn({ method: 'GET' })
  .middleware([staticFunctionMiddleware])
  .handler(async () => {
    return 'Hello, world!'
  })
```

Ensure that `staticFunctionMiddleware` is the final middleware!

This pattern goes as follows:

- Build-time
  - During build-time prerendering, a server function with `staticFunctionMiddleware` is executed
  - The result is cached with your build output as a static JSON file under a derived key (function ID + params/payload hash)
  - The result is returned as normal during prerendering/static-generation and used to prerender the page
- Runtime
  - Initially, the prerendered page's html is served and the server function data is embedded in the html
  - When the client mounts, the embedded server function data is hydrated
  - For future client-side invocations, the server function is replaced with a fetch call to the static JSON file
