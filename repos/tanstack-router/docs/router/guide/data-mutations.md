---
title: Data Mutations
---

Since TanStack router does not store or cache data, it's role in data mutation is slim to none outside of reacting to potential URL side-effects from external mutation events. That said, we've compiled a list of mutation-related features you might find useful and libraries that implement them.

Look for and use mutation utilities that support:

- Handling and caching submission state
- Providing both local and global optimistic UI support
- Built-in hooks to wire up invalidation (or automatically support it)
- Handling multiple in-flight mutations at once
- Organizing mutation state as a globally accessible resource
- Submission state history and garbage collection

Some suggested libraries:

- [TanStack Query](https://tanstack.com/query/latest/docs/react/guides/mutations)
- [SWR](https://swr.vercel.app/)
- [RTK Query](https://redux-toolkit.js.org/rtk-query/overview)
- [urql](https://formidable.com/open-source/urql/)
- [Relay](https://relay.dev/)
- [Apollo](https://www.apollographql.com/docs/react/)

Or, even...

- [Zustand](https://zustand-demo.pmnd.rs/)
- [Jotai](https://jotai.org/)
- [Recoil](https://recoiljs.org/)
- [Redux](https://redux.js.org/)

Similar to data fetching, mutation state isn't a one-size-fits-all solution, so you'll need to pick a solution that fits your needs and your team's needs. We recommend trying out a few different solutions and seeing what works best for you.

> ⚠️ Still here? Submission state is an interesting topic when it comes to persistence. Do you keep every mutation around forever? How do you know when to get rid of it? What if the user navigates away from the screen and then back? Let's dig in!

## Invalidating TanStack Router after a mutation

TanStack Router comes with short-term caching built-in. So even though we're not storing any data after a route match is unmounted, there is a high probability that if any mutations are made related to the data stored in the Router, the current route matches' data could become stale.

When mutations related to loader data are made, we can use `router.invalidate` to force the router to reload all of the current route matches:

```tsx
const router = useRouter()

const addTodo = async (todo: Todo) => {
  try {
    await api.addTodo()
    router.invalidate()
  } catch {
    //
  }
}
```

Invalidating all of the current route matches happens in the background, so existing data will continue to be served until the new data is ready, just as if you were navigating to a new route.

If you want to await the invalidation until all loaders have finished, pass `{sync: true}` into `router.invalidate`:

```tsx
const router = useRouter()

const addTodo = async (todo: Todo) => {
  try {
    await api.addTodo()
    await router.invalidate({ sync: true })
  } catch {
    //
  }
}
```

## Long-term mutation State

Regardless of the mutation library used, mutations often create state related to their submission. While most mutations are set-and-forget, some mutation states are more long-lived, either to support optimistic UI or to provide feedback to the user about the status of their submissions. Most state managers will correctly keep this submission state around and expose it to make it possible to show UI elements like loading spinners, success messages, error messages, etc.

Let's consider the following interactions:

- User navigates to the `/posts/123/edit` screen to edit a post
- User edits the `123` post and upon success, sees a success message below the editor that the post was updated
- User navigates to the `/posts` screen
- User navigates back to the `/posts/123/edit` screen again

Without notifying your mutation management library about the route change, it's possible that your submission state could still be around and your user would still see the **"Post updated successfully"** message when they return to the previous screen. This is not ideal. Obviously, our intent wasn't to keep this mutation state around forever, right?!

## Using mutation keys

Hopefully and hypothetically, the easiest way is for your mutation library to support a keying mechanism that will allow your mutations's state to be reset when the key changes:

```tsx
const routeApi = getRouteApi('/room/$roomId/chat')

function ChatRoom() {
  const { roomId } = routeApi.useParams()

  const sendMessageMutation = useCoolMutation({
    fn: sendMessage,
    // Clear the mutation state when the roomId changes
    // including any submission state
    key: ['sendMessage', roomId],
  })

  // Fire off a bunch of messages
  const test = () => {
    sendMessageMutation.mutate({ roomId, message: 'Hello!' })
    sendMessageMutation.mutate({ roomId, message: 'How are you?' })
    sendMessageMutation.mutate({ roomId, message: 'Goodbye!' })
  }

  return (
    <>
      {sendMessageMutation.submissions.map((submission) => {
        return (
          <div>
            <div>{submission.status}</div>
            <div>{submission.message}</div>
          </div>
        )
      })}
    </>
  )
}
```

## Using the `router.subscribe` method

See the [Router Events guide](./router-events.md) for a more complete walkthrough of the available events and when to use them.

For libraries that don't have a keying mechanism, we'll likely need to manually reset the mutation state when the user navigates away from the screen. To solve this, we can use TanStack Router's `invalidate` and `subscribe` method to clear mutation states when the user is no longer in need of them.

The `router.subscribe` method is a function that subscribes a callback to various router events. The event in particular that we'll use here is the `onResolved` event. It's important to understand that this event is fired when the location path is _changed (not just reloaded) and has finally resolved_.

This is a great place to reset your old mutation states. Here's an example:

```tsx
const router = createRouter()
const coolMutationCache = createCoolMutationCache()

const unsubscribeFn = router.subscribe('onResolved', () => {
  // Reset mutation states when the route changes
  coolMutationCache.clear()
})
```
