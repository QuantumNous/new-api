---
title: Decisions on Developer Experience
---

When people first start using TanStack Router, they often have a lot of questions that revolve around the following themes:

> Why do I have to do things this way?

> Why is it done this way? and not that way?

> I'm used to doing it this way, why should I change?

And they are all valid questions. For the most part, people are used to using routing libraries that are very similar to each other. They all have a similar API, similar concepts, and similar ways of doing things.

But TanStack Router is different. It's not your average routing library. It's not your average state management library. It's not your average anything.

> [!TIP]
> The examples in this guide use React for components and code snippets, but the same principles apply to Solid. The only difference is in the syntax and API of the framework, but the underlying concepts and design decisions are the same.

## TanStack Router's origin story

It's important to remember that TanStack Router's origins stem from [Nozzle.io](https://nozzle.io?utm_source=tanstack)'s need for a client-side routing solution that offered a first-in-class _URL Search Parameters_ experience without compromising on the **_type-safety_** that was required to power its complex dashboards.

And so, from TanStack Router's very inception, every facet of its design was meticulously thought out to ensure that its type-safety and developer experience were second to none.

## How does TanStack Router achieve this?

> TypeScript! TypeScript! TypeScript!

Every aspect of TanStack Router is designed to be as type-safe as possible, and this is achieved by leveraging TypeScript's type system to its fullest extent. This involves using some very advanced and complex types, type inference, and other features to ensure that the developer experience is as smooth as possible.

But to achieve this, we had to make some decisions that deviate from the norms in the routing world.

1. [**Route configuration boilerplate?**](#why-is-the-routers-configuration-done-this-way): You have to define your routes in a way that allows TypeScript to infer the types of your routes as much as possible.
2. [**TypeScript module declaration for the router?**](#declaring-the-router-instance-for-type-inference): You have to pass the `Router` instance to the rest of your application using TypeScript's module declaration.
3. [**Why push for file-based routing over code-based?**](#why-is-file-based-routing-the-preferred-way-to-define-routes): We push for file-based routing as the preferred way to define your routes.

> TLDR; All the design decisions in the developer experience of using TanStack Router are made so that you can have a best-in-class type-safety experience without compromising on the control, flexibility, and maintainability of your route configurations.

## Why is the Router's configuration done this way?

When you want to leverage the TypeScript's inference features to its fullest, you'll quickly realize that _Generics_ are your best friend. And so, TanStack Router uses Generics everywhere to ensure that the types of your routes are inferred as much as possible.

This means that you have to define your routes in a way that allows TypeScript to infer the types of your routes as much as possible.

> Can I use JSX to define my routes?

Using JSX for defining your routes is **out of the question**, as TypeScript will not be able to infer the route configuration types of your router.

```tsx
// ⛔️ This is not possible
function App() {
  return (
    <Router>
      <Route path="/posts" component={PostsPage} />
      <Route path="/posts/$postId" component={PostIdPage} />
      {/* ... */}
    </Router>
    // ^? TypeScript cannot infer the routes in this configuration
  )
}
```

And since this would mean that you'd have to manually type the `to` prop of the `<Link>` component and wouldn't catch any errors until runtime, it's not a viable option.

> Maybe I could define my routes as a tree of nested objects?

```tsx
// ⛔️ This file will just keep growing and growing...
const router = createRouter({
  routes: {
    posts: {
      component: PostsPage, // /posts
      children: {
        $postId: {
          component: PostIdPage, // /posts/$postId
        },
      },
    },
    // ...
  },
})
```

At first glance, this seems like a good idea. It's easy to visualize the entire route hierarchy in one go. But this approach has a couple of big downsides that make it not ideal for large applications:

- **It's not very scalable**: As your application grows, the tree will grow and become harder to manage. And since it's all defined in one file, it can become very hard to maintain.
- **It's not great for code-splitting**: You'd have to manually code-split each component and then pass it into the `component` property of the route, further complicating the route configuration with an ever-growing route configuration file.

This only gets worse as you begin to use more features of the router, such as nested context, loaders, search param validation, etc.

> So, what's the best way to define my routes?

What we found to be the best way to define your routes is to abstract the definition of the route configuration outside of the route-tree. Then stitch together your route configurations into a single cohesive route-tree that is then passed into the `createRouter` function.

You can read more about [code-based routing](./routing/code-based-routing.md) to see how to define your routes in this way.

> [!TIP]
> Finding Code-based routing to be a bit too cumbersome? See why [file-based routing](#why-is-file-based-routing-the-preferred-way-to-define-routes) is the preferred way to define your routes.

## Declaring the Router instance for type inference

> Why do I have to declare the `Router`?

> This declaration stuff is way too complicated for me...

Once you've constructed your routes into a tree and passed it into your Router instance (using `createRouter`) with all the generics working correctly, you then need to somehow pass this information to the rest of your application.

There were two approaches we considered for this:

1. **Imports**: You could import the `Router` instance from the file where you created it and use it directly in your components.

```tsx
import { router } from '@/src/app'
export const PostsIdLink = () => {
  return (
    <Link<typeof router> to="/posts/$postId" params={{ postId: '123' }}>
      Go to post 123
    </Link>
  )
}
```

A downside to this approach is that you'd have to import the entire `Router` instance into every file where you want to use it. This can lead to increased bundle sizes and can be cumbersome to manage, and only get worse as your application grows and you use more features of the router.

2. **Module declaration**: You can use TypeScript's module declaration to declare the `Router` instance as a module that can be used for type inference anywhere in your application without having to import it.

You'll do this once in your application.

```tsx
// src/app.tsx
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

And then you can benefit from its auto-complete anywhere in your app without having to import it.

```tsx
export const PostsIdLink = () => {
  return (
    <Link
      to="/posts/$postId"
      // ^? TypeScript will auto-complete this for you
      params={{ postId: '123' }} // and this too!
    >
      Go to post 123
    </Link>
  )
}
```

We went with **module declaration**, as it is what we found to be the most scalable and maintainable approach with the least amount of overhead and boilerplate.

## Why is file-based routing the preferred way to define routes?

> Why are the docs pushing for file-based routing?

> I'm used to defining my routes in a single file, why should I change?

Something you'll notice (quite soon) in the TanStack Router documentation is that we push for **file-based routing** as the preferred method for defining your routes. This is because we've found that file-based routing is the most scalable and maintainable way to define your routes.

> [!TIP]
> Before you continue, it's important you have a good understanding of [code-based routing](./routing/code-based-routing.md) and [file-based routing](./routing/file-based-routing.md).

As mentioned in the beginning, TanStack Router was designed for complex applications that require a high degree of type-safety and maintainability. And to achieve this, the configuration of the router has been done in a precise way that allows TypeScript to infer the types of your routes as much as possible.

A key difference in the set-up of a _basic_ application with TanStack Router, is that your route configurations require a function to be provided to `getParentRoute`, that returns the parent route of the current route.

```tsx
import { createRoute } from '@tanstack/react-router'
import { postsRoute } from './postsRoute'

export const postsIndexRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '/',
})
```

At this stage, this is done so the definition of `postsIndexRoute` can be aware of its location in the route tree and so that it can correctly infer the types of the `context`, `path params`, `search params` returned by the parent route. Incorrectly defining the `getParentRoute` function means that the properties of the parent route will not be correctly inferred by the child route.

As such, this is a critical part of the route configuration and a point of failure if not done correctly.

But this is only one part of setting up a basic application. TanStack Router requires all the routes (including the root route) to be stitched into a **_route-tree_** so that it may be passed into the `createRouter` function before declaring the `Router` instance on the module for type inference. This is another critical part of the route configuration and a point of failure if not done correctly.

> 🤯 If this route-tree were in its own file for an application with ~40-50 routes, it can easily grow up to 700+ lines.

```tsx
const routeTree = rootRoute.addChildren([
  postsRoute.addChildren([postsIndexRoute, postsIdRoute]),
])
```

This complexity only increases as you begin to use more features of the router, such as nested context, loaders, search param validation, etc. As such, it no longer becomes feasible to define your routes in a single file. And so, users end up building their own _semi consistent_ way of defining their routes across multiple files. This can lead to inconsistencies and errors in the route configuration.

Finally, comes the issue of code-splitting. As your application grows, you'll want to code-split your components to reduce the initial bundle size of your application. This can be a bit of a headache to manage when you're defining your routes in a single file or even across multiple files.

```tsx
import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { postsRoute } from './postsRoute'

export const postsIndexRoute = createRoute({
  getParentRoute: () => postsRoute,
  path: '/',
  component: lazyRouteComponent(() => import('../page-components/posts/index')),
})
```

All of this boilerplate, no matter how essential for providing a best-in-class type-inference experience, can be a bit overwhelming and can lead to inconsistencies and errors in the route configuration.

... and this example configuration is just for rendering a single codes-split route. Imagine having to do this for 40-50 routes. Now remember that you still haven't touched the `context`, `loaders`, `search param validation`, and other features of the router 🤕.

> So, why's file-based routing the preferred way?

TanStack Router's file-based routing is designed to solve all of these issues. It allows you to define your routes in a predictable way that is easy to manage and maintain, and is scalable as your application grows.

The file-based routing approach is powered by the TanStack Router Bundler Plugin. It performs 3 essential tasks that solve the pain points in route configuration when using code-based routing:

1. **Route configuration boilerplate**: It generates the boilerplate for your route configurations.
2. **Route tree stitching**: It stitches together your route configurations into a single cohesive route-tree. Also in the background, it correctly updates the route configurations to define the `getParentRoute` function match the routes with their parent routes.
3. **Code-splitting**: It automatically code-splits your route content components and updates the route configurations with the correct component. Additionally, at runtime, it ensures that the correct component is loaded when the route is visited.

Let's take a look at how the route configuration for the previous example would look like with file-based routing.

```tsx
// src/routes/posts/index.ts
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/')({
  component: () => 'Posts index component goes here!!!',
})
```

That's it! No need to worry about defining the `getParentRoute` function, stitching together the route-tree, or code-splitting your components. The TanStack Router Bundler Plugin handles all of this for you.

At no point does the TanStack Router Bundler Plugin take away your control over your route configurations. It's designed to be as flexible as possible, allowing you to define your routes in a way that suits your application whilst reducing the boilerplate and complexity of the route configuration.

Check out the guides for [file-based routing](./routing/file-based-routing.md) and [code-splitting](./guide/code-splitting.md) for a more in-depth explanation of how they work in TanStack Router.
