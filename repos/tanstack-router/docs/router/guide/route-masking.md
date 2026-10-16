---
title: Route Masking
---

Route masking is a way to mask the actual URL of a route that gets persisted to the browser's history and URL bar. This is useful for scenarios where you want to show a different URL than the one that is actually being navigated to and then falling back to the displayed URL when it is shared and (optionally) when the page is reloaded. Here's a few examples:

- Navigating to a modal route like `/photo/5/modal`, but masking the actual URL as `/photos/5`
- Navigating to a modal route like `/post/5/comments`, but masking the actual URL as `/posts/5`
- Navigating to a route with the search param `?showLogin=true`, but masking the URL to _not_ contain the search param
- Navigating to a route with the search param `?modal=settings`, but masking the URL as `/settings'

Each of these scenarios can be achieved with route masking and even extended to support more advanced patterns like [parallel routes](./parallel-routes.md).

## How does route masking work?

> [!IMPORTANT]
> You **do not** need to understand how route masking works in order to use it. This section is for those who are curious about how it works under the hood. Skip to [How do I use route masking?](#how-do-i-use-route-masking) to learn how to use it!.

Route masking utilizes the `location.state` API to store the desired runtime location inside of the location that will get written to the URL. It stores this runtime location under the `__tempLocation` state property:

```tsx
const location = {
  pathname: '/photos/5',
  search: '',
  hash: '',
  state: {
    key: 'wesdfs',
    __tempKey: 'sadfasd',
    __tempLocation: {
      pathname: '/photo/5/modal',
      search: '',
      hash: '',
      state: {},
    },
  },
}
```

When the router parses a location from history with the `location.state.__tempLocation` property, it will use that location instead of the one that was parsed from the URL. This allows you to navigate to a route like `/photos/5` and have the router actually navigate to `/photo/5/modal` instead. When this happens, the history location is saved back into the `location.maskedLocation` property, just in case we need to know what the **actual URL** is. One example of where this is used is in the Devtools where we detect if a route is masked and show the actual URL instead of the masked one!

Remember, you don't need to worry about any of this. It's all handled for you automatically under the hood!

## How do I use route masking?

Route masking is a simple API that can be used in 2 ways:

- Imperatively via the `mask` option available on the `<Link>` and `navigate()` APIs
- Declaratively via the Router's `routeMasks` option

When using either route masking APIs, the `mask` option accepts the same navigation object that the `<Link>` and `navigate()` APIs accept. This means you can use the same `to`, `replace`, `state`, and `search` options that you're already familiar with. The only difference is that the `mask` option will be used to mask the URL of the route being navigated to.

> 🧠 The mask option is also **type-safe**! This means that if you're using TypeScript, you'll get type errors if you try to pass an invalid navigation object to the `mask` option. Booyah!

### Imperative route masking

The `<Link>` and `navigate()` APIs both accept a `mask` option that can be used to mask the URL of the route being navigated to. Here's an example of using it with the `<Link>` component:

```tsx
<Link
  to="/photos/$photoId/modal"
  params={{ photoId: 5 }}
  mask={{
    to: '/photos/$photoId',
    params: {
      photoId: 5,
    },
  }}
>
  Open Photo
</Link>
```

And here's an example of using it with the `navigate()` API:

```tsx
const navigate = useNavigate()

function onOpenPhoto() {
  navigate({
    to: '/photos/$photoId/modal',
    params: { photoId: 5 },
    mask: {
      to: '/photos/$photoId',
      params: {
        photoId: 5,
      },
    },
  })
}
```

### Declarative route masking

In addition to the imperative API, you can also use the Router's `routeMasks` option to declaratively mask routes. Instead of needing to pass the `mask` option to every `<Link>` or `navigate()` call, you can instead create a route mask on the Router to mask routes that match a certain pattern. Here's an example of the same route mask from above, but using the `routeMasks` option instead:

<!-- ::start:framework -->

# React

```tsx
import { createRouteMask } from '@tanstack/react-router'

const photoModalToPhotoMask = createRouteMask({
  routeTree,
  from: '/photos/$photoId/modal',
  to: '/photos/$photoId',
  params: (prev) => ({
    photoId: prev.photoId,
  }),
})

const router = createRouter({
  routeTree,
  routeMasks: [photoModalToPhotoMask],
})
```

# Solid

```tsx
import { createRouteMask } from '@tanstack/solid-router'

const photoModalToPhotoMask = createRouteMask({
  routeTree,
  from: '/photos/$photoId/modal',
  to: '/photos/$photoId',
  params: (prev) => ({
    photoId: prev.photoId,
  }),
})

const router = createRouter({
  routeTree,
  routeMasks: [photoModalToPhotoMask],
})
```

<!-- ::end:framework -->

When creating a route mask, you'll need to pass 1 argument with at least:

- `routeTree` - The route tree that the route mask will be applied to
- `from` - The route ID that the route mask will be applied to
- `...navigateOptions` - The standard `to`, `search`, `params`, `replace`, etc options that the `<Link>` and `navigate()` APIs accept

> 🧠 The `createRouteMask` option is also **type-safe**! This means that if you're using TypeScript, you'll get type errors if you try to pass an invalid route mask to the `routeMasks` option.

## Unmasking when sharing the URL

URLs are automatically unmasked when they are shared since as soon as a URL is detached from your browsers local history stack, the URL masking data is no longer available. Essentially, as soon as you copy and paste a URL out of your history, its masking data is lost... after all, that's the point of masking a URL!

## Local Unmasking Defaults

**By default, URLs are not unmasked when the page is reloaded locally**. Masking data is stored in the `location.state` property of the history location, so as long as the history location is still in memory in your history stack, the masking data will be available and the URL will continue to be masked.

## Unmasking on page reload

**As stated above, URLs are not unmasked when the page is reloaded by default**.

If you want to unmask a URL locally when the page is reloaded, you have 3 options, each overriding the previous one in priority if passed:

- Set the Router's default `unmaskOnReload` option to `true`
- Return the `unmaskOnReload: true` option from the masking function when creating a route mask with `createRouteMask()`
- Pass the `unmaskOnReload: true` option to the `<Link`> component or `navigate()` API
