---
title: Route Trees
---

TanStack Router uses a nested route tree to match up the URL with the correct component tree to render.

To build a route tree, TanStack Router supports:

- [File-Based Routing](./file-based-routing.md)
- [Code-Based Routing](./code-based-routing.md)

Both methods support the exact same core features and functionality, but **file-based routing requires less code for the same or better results**. For this reason, **file-based routing is the preferred and recommended way** to configure TanStack Router. Most of the documentation is written from the perspective of file-based routing.

## Route Trees

Nested routing is a powerful concept that allows you to use a URL to render a nested component tree. For example, given the URL of `/blog/posts/123`, you could create a route hierarchy that looks like this:

```tsx
├── blog
│   ├── posts
│   │   ├── $postId
```

And render a component tree that looks like this:

```tsx
<Blog>
  <Posts>
    <Post postId="123" />
  </Posts>
</Blog>
```

Let's take that concept and expand it out to a larger site structure, but with file-names now:

```
/routes
├── __root.tsx
├── index.tsx
├── about.tsx
├── posts/
│   ├── index.tsx
│   ├── $postId.tsx
├── posts.$postId.edit.tsx
├── settings/
│   ├── profile.tsx
│   ├── notifications.tsx
├── _pathlessLayout/
│   ├── route-a.tsx
├── ├── route-b.tsx
├── files/
│   ├── $.tsx
```

The above is a valid route tree configuration that can be used with TanStack Router! There's a lot of power and convention to unpack with file-based routing, so let's break it down a bit.

## Route Tree Configuration

Route trees can be configured using a few different ways:

- [Flat Routes](./file-based-routing.md#flat-routes)
- [Directories](./file-based-routing.md#directory-routes)
- [Mixed Flat Routes and Directories](./file-based-routing.md#mixed-flat-and-directory-routes)
- [Virtual File Routes](./virtual-file-routes.md)
- [Code-Based Routes](./code-based-routing.md)

Please be sure to check out the full documentation links above for each type of route tree, or just proceed to the next section to get started with file-based routing.
