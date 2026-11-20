---
id: deferred-hydration
title: Deferred Hydration
---

> Deferred hydration is experimental

On an initial page load, TanStack Start server-renders your page so the browser
can show useful HTML quickly. Hydration is the client-side work that turns that
initial HTML document into an interactive app. It loads and executes JavaScript,
runs components, attaches event handlers, and reconnects the existing DOM to
React.

Deferred hydration applies to this initial document hydration work. After the
app is already running, subsequent client-side navigations render through the
client app; there is no initial server HTML for TanStack Start to preserve.

By default, TanStack Start hydrates the full document. That is usually the
simplest and safest behavior, but large pages can spend meaningful startup time
loading JavaScript and hydrating parts of the page that the user may not need
right away.

Deferred hydration lets you mark selected parts of a page as "not interactive
yet". The server HTML remains in the document, but TanStack Start waits to
hydrate that boundary until a strategy says it is time. By default, the compiler
also moves the boundary children into a separate JavaScript chunk so the browser
can delay loading that code too.

Use deferred hydration when a part of the page should be visible, styled, and
indexable immediately, but does not need to be interactive immediately.

## Add A Deferred Boundary

Use `Hydrate` with a strategy from `@tanstack/react-start/hydration`:

```tsx
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'

export function ProductPage() {
  return (
    <Hydrate when={visible({ rootMargin: '400px' })}>
      <Reviews />
    </Hydrate>
  )
}
```

On the initial server response, `Reviews` is still rendered to HTML. During the
initial client hydration pass, that HTML is preserved but the `Reviews` React
tree does not hydrate yet. When the boundary comes within `400px` of the
viewport, TanStack Start loads the deferred child chunk and hydrates the
boundary.

`Hydrate` only preserves server HTML that exists in the initial document. If the
same boundary first mounts later, for example after client-side navigation,
there is no server HTML to preserve, so it renders normally on the client.

## Choose What To Defer

The right boundary depends on your page, your product priorities, and real user
behavior. TanStack Start cannot know which parts of your page are safe to delay.

Good candidates are usually SSR content that is not needed for immediate
interaction:

- Below-the-fold reviews, comments, product details, related content, or long
  marketing sections.
- Rich widgets such as maps, charts, carousels, video players, editors, or
  embeds.
- Panels that are activated by intent, such as filters, preview panes, or
  contextual tools.
- UI that only matters for a matching media query.
- Static server-rendered content that should not hydrate on the initial
  document.

Poor candidates are parts of the page users may need immediately:

- Primary navigation, route chrome, search boxes, and account controls.
- Above-the-fold forms, add-to-cart buttons, checkout actions, or consent
  controls.
- The interactive part of the LCP or hero area when users may click it
  immediately.
- Accessibility-critical controls that must be keyboard-ready as soon as the
  page appears.
- Components whose props, context, or shared state are expected to update
  immediately after app startup.

Measure each boundary. A useful boundary reduces startup JavaScript or hydration
work without making expected interactions feel late.

## Comparison To Astro Islands

Astro starts static and asks "what should come alive?" Each answer is an
isolated framework root dropped into HTML. Islands are independent runtimes
sharing a DOM.

TanStack Start starts fully interactive and asks "what can wait?" The whole
document hydrates as one React tree by default; `Hydrate` boundaries are gates
inside that tree. Context, state, and events flow through normally, and
hydration is parent-first.

Same trigger vocabulary, different substrate: Astro composes runtimes, Start
schedules one. That is why Start gets `interaction()`, `condition()`, and intent
bubbling, and why Astro gets multi-framework.

## Comparison To React Selective Hydration

React's selective hydration controls the order in which server-rendered
boundaries hydrate. Deferred hydration controls whether and when each
boundary hydrates at all.

When React hydrates a streaming SSR page, every server-rendered
`<Suspense>` boundary will eventually hydrate. Selective hydration just
decides the order: each boundary hydrates as soon as its code arrives,
and React jumps a boundary to the front of the queue if the user clicks
inside it. The work is fixed by what the server rendered; React
schedules it to feel responsive.

Deferred hydration changes what is in the queue in the first place. A
`Hydrate` boundary names a condition — `visible()`, `idle()`,
`interaction()`, `media()`, `condition()`, or `never()` — and the
boundary stays as static server HTML until that condition fires. By
default the child JavaScript also moves into a separate chunk that the
browser does not download until the boundary is about to hydrate. If the
condition never fires, the boundary never hydrates and its code is never
fetched.

The two compose. A `Hydrate` boundary decides whether and when React
starts hydrating a subtree; once it opens, anything inside it (including
`<Suspense>` boundaries) flows back into React's normal hydration
scheduler. Use `<Suspense>` when hydration must happen and you want React
to prioritize it well. Use `Hydrate` when hydration might not need to
happen at all.

## The Three Decisions

Each `Hydrate` boundary has three performance decisions:

| Decision    | Option     | What it controls                                                   |
| ----------- | ---------- | ------------------------------------------------------------------ |
| Hydration   | `when`     | When the preserved server HTML becomes interactive.                |
| Code split  | `split`    | Whether the children move into a generated deferred child chunk.   |
| Preparation | `prefetch` | Whether work starts before the `when` strategy hydrates the child. |

### `when`: decide when the boundary hydrates

`when` is required. Pass a strategy object for the common case:

```tsx
<Hydrate when={visible()}>
  <Reviews />
</Hydrate>
```

Pass a function when the decision needs browser-only information:

```tsx
import { Hydrate } from '@tanstack/react-start'
import { interaction, visible } from '@tanstack/react-start/hydration'

export function RecommendationsBoundary() {
  return (
    <Hydrate
      when={() =>
        navigator.connection?.saveData
          ? interaction({ events: 'click' })
          : visible()
      }
    >
      <Recommendations />
    </Hydrate>
  )
}
```

The function form is evaluated only on the client and must synchronously return
a strategy. Use `never()` when you intentionally want the initial server HTML to
stay static.

### `split`: decide whether to create a separate child chunk

By default, `Hydrate` splits the children into a generated child chunk:

```tsx
<Hydrate when={visible()}>
  <HeavyWidget />
</Hydrate>
```

This delays both hydration work and child JavaScript loading.

Set `split={false}` when the child code is small or already needed elsewhere,
and you only want to delay hydration work:

```tsx
import { Hydrate } from '@tanstack/react-start'
import { idle } from '@tanstack/react-start/hydration'

export function SmallWidgetBoundary() {
  return (
    <Hydrate when={idle()} split={false}>
      <SmallWidget />
    </Hydrate>
  )
}
```

### `prefetch`: decide whether to start loading before hydration

`prefetch` starts loading before the boundary hydrates. It has two forms:

| Form                | Example                             | Use it for                                                     |
| ------------------- | ----------------------------------- | -------------------------------------------------------------- |
| Prefetch strategy   | `prefetch={idle()}`                 | Preloading the generated child chunk before hydration.         |
| Procedural prefetch | `prefetch={async (ctx) => { ... }}` | Preloading the child chunk plus data or other async resources. |

Both forms start work early, but they do not change when the boundary becomes
interactive. That is still controlled by `when`.

A prefetch strategy is the small, declarative form:

```tsx
import { idle, interaction, visible } from '@tanstack/react-start/hydration'

<Hydrate when={interaction()} prefetch={idle()}>
  <ProductRecommendations />
</Hydrate>

<Hydrate
  when={interaction()}
  prefetch={visible({ rootMargin: '1200px' })}
>
  <RelatedProducts />
</Hydrate>
```

Strategy-form `prefetch` downloads the generated child chunk before the boundary
hydrates. This can make the later hydration trigger feel faster, because the
browser may already have the chunk by the time `when` resolves. Generated child
chunks only exist when `split` is enabled, so TypeScript rejects strategy-form
`prefetch` when `split={false}`.

Use procedural prefetch when you need custom work:

```tsx
import { useQueryClient } from '@tanstack/react-query'
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'

function DeferredReviews() {
  const queryClient = useQueryClient()

  return (
    <Hydrate
      when={visible()}
      prefetch={async ({ preload }) => {
        await preload()
        await queryClient.prefetchQuery(reviewsQueryOptions)
      }}
    >
      <Reviews />
    </Hydrate>
  )
}
```

Procedural prefetch also works with `split={false}`. In that case, `preload()`
is a resolved no-op, but the function can still prepare data or other
resources.

## Common Recipes

### Hydrate below-the-fold SSR content

```tsx
import { Hydrate } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'

export function ProductPage() {
  return (
    <>
      <ProductHero />
      <BuyBox />

      <Hydrate when={visible({ rootMargin: '800px' })}>
        <Reviews />
      </Hydrate>
    </>
  )
}
```

Use a positive `rootMargin` when the boundary should hydrate before it actually
enters the viewport.

### Download the child chunk before it is needed

```tsx
import { Hydrate } from '@tanstack/react-start'
import { idle, visible } from '@tanstack/react-start/hydration'

export function ReviewsBoundary() {
  return (
    <Hydrate when={visible({ rootMargin: '200px' })} prefetch={idle()}>
      <Reviews />
    </Hydrate>
  )
}
```

This keeps the boundary non-interactive until it is close to the viewport, but
starts loading the child chunk during idle time.

### Keep a widget cold until user intent

```tsx
import { Hydrate } from '@tanstack/react-start'
import { interaction, visible } from '@tanstack/react-start/hydration'

export function RecommendationsBoundary() {
  return (
    <Hydrate
      when={interaction({ events: ['focusin', 'click'] })}
      prefetch={visible({ rootMargin: '1200px' })}
    >
      <RecommendationCarousel />
    </Hydrate>
  )
}
```

This is useful for expensive controls that are visible or nearby, but only
matter when the user reaches for them.

### Delay hydration without code splitting

```tsx
import { Hydrate } from '@tanstack/react-start'
import { idle } from '@tanstack/react-start/hydration'

export function BadgeBoundary() {
  return (
    <Hydrate when={idle()} split={false}>
      <SmallPersonalizedBadge />
    </Hydrate>
  )
}
```

Use this when the JavaScript is already part of the startup bundle or when a
separate child chunk would not be worth it.

### Keep initial SSR HTML static

```tsx
import { Hydrate } from '@tanstack/react-start'
import { never } from '@tanstack/react-start/hydration'

export function MarketingPage() {
  return (
    <Hydrate when={never()}>
      <StaticTrustBadges />
    </Hydrate>
  )
}
```

`never()` preserves the existing server HTML and does not hydrate the boundary
during initial document hydration. If the same boundary mounts later during
client-side navigation, it renders normally because there is no initial server
HTML to preserve. `never()` cannot be used as a prefetch strategy.

### Reuse Hydrate props

Use `HydrateOptions` for reusable objects that you spread into `Hydrate`:

```tsx
import { Hydrate } from '@tanstack/react-start'
import type { HydrateOptions } from '@tanstack/react-start'
import { visible } from '@tanstack/react-start/hydration'

const belowFoldProps = {
  when: () => visible({ rootMargin: '800px' }),
} satisfies HydrateOptions

export function Page() {
  return (
    <Hydrate
      {...belowFoldProps}
      prefetch={async ({ preload }) => {
        await preload()
      }}
    >
      <Widget />
    </Hydrate>
  )
}
```

Inline `when` and `prefetch` functions are supported. You do not need to wrap
them in `useCallback`; TanStack Start keeps the latest callback internally and
does not re-register hydration listeners just because a function identity
changed. If the meaning of a boundary changes, use a normal React `key` to
create a new boundary.

## Hydrate Props Reference

`Hydrate` accepts these props:

| Prop         | Type                                                     | Notes                                                                                                                                                     |
| ------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `when`       | `HydrationStrategy \| () => HydrationStrategy`           | Required. Controls when the boundary hydrates. Function form is client-only and synchronous.                                                              |
| `prefetch`   | `HydrationPrefetchStrategy \| HydrationPrefetchFunction` | Optional. Strategy form preloads the split child chunk. Function form can preload chunks, data, or other resources, and can be used with `split={false}`. |
| `split`      | `boolean`                                                | Defaults to `true`. Set literal `false` to disable compiler extraction and only defer hydration work.                                                     |
| `fallback`   | `ReactNode`                                              | Client-only loading UI for boundaries that mount after the app has already hydrated and then suspend on the child chunk or child `Suspense`.              |
| `onHydrated` | `() => void`                                             | Fires once after the boundary has hydrated on the client.                                                                                                 |

## Strategy Reference

Import strategies from `@tanstack/react-start/hydration`.

| Strategy        | Behavior                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------ |
| `load()`        | Hydrates as soon as the app hydrates.                                                      |
| `idle()`        | Hydrates in `requestIdleCallback`, or after `timeout` when idle callbacks are unavailable. |
| `visible()`     | Hydrates when the boundary marker enters the viewport.                                     |
| `media()`       | Hydrates when the media query matches.                                                     |
| `interaction()` | Hydrates on configured interaction intent events.                                          |
| `condition()`   | Hydrates once the condition is truthy.                                                     |
| `never()`       | Never hydrates the initial server-rendered boundary.                                       |

Strategy options:

| Strategy      | Options                                                                                 |
| ------------- | --------------------------------------------------------------------------------------- |
| `idle`        | `{ timeout?: number }`, defaults to `2000`.                                             |
| `visible`     | `{ rootMargin?: string; threshold?: number \| Array<number> }`, default margin `600px`. |
| `media`       | Query string, for example `media('(min-width: 800px)')`.                                |
| `interaction` | `{ events?: supported event or readonly array of supported events }`.                   |
| `condition`   | Boolean or boolean-returning function.                                                  |

Supported interaction events are `auxclick`, `click`, `contextmenu`,
`dblclick`, `focusin`, `keydown`, `keyup`, `mousedown`, `mouseenter`,
`mouseover`, `mouseup`, `pointerdown`, `pointerenter`, `pointerover`, and
`pointerup`.

The default `interaction()` event list is `pointerenter`, `focusin`,
`pointerdown`, and `click`. Use `events` when a boundary should listen to a
different event or a smaller set:

```tsx
import { Hydrate } from '@tanstack/react-start'
import { interaction } from '@tanstack/react-start/hydration'

<Hydrate when={interaction({ events: 'dblclick' })}>
  <PreviewEditor />
</Hydrate>

<Hydrate when={interaction({ events: ['contextmenu', 'dblclick'] })}>
  <ContextMenuEditor />
</Hydrate>
```

After a `condition()` boundary hydrates, it stays hydrated even if the condition
later becomes false:

```tsx
import { Hydrate } from '@tanstack/react-start'
import { condition } from '@tanstack/react-start/hydration'

export function CartRecommendationsBoundary() {
  return (
    <Hydrate when={condition(isCartOpen)}>
      <CartRecommendations />
    </Hydrate>
  )
}
```

## Prefetch Reference

Procedural prefetch receives a context object:

| Property            | Meaning                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- |
| `preload()`         | Loads the compiler-generated child chunk. It resolves immediately when `split={false}`. |
| `waitFor(strategy)` | Waits for a prefetch strategy, the hydration trigger, or abort.                         |
| `signal`            | `AbortSignal` for cancelable async work such as `fetch`.                                |
| `element`           | Boundary marker element for custom observers or DOM measurements.                       |

`waitFor(strategy)` resolves with:

| Result       | Meaning                                                             |
| ------------ | ------------------------------------------------------------------- |
| `'prefetch'` | The supplied prefetch strategy resolved normally.                   |
| `'hydrate'`  | The boundary's hydration trigger fired first. Do required work now. |
| `'abort'`    | The boundary unmounted or the prefetch lifecycle was abandoned.     |

The promise returned from procedural prefetch is meaningful. Awaited work blocks
hydration if the `when` strategy resolves before the prefetch function
finishes:

```tsx
<Hydrate
  when={visible()}
  prefetch={async ({ preload }) => {
    await preload()
  }}
>
  <Widget />
</Hydrate>
```

Fire-and-forget work does not block hydration:

```tsx
<Hydrate
  when={visible()}
  prefetch={({ preload }) => {
    void preload()
  }}
>
  <Widget />
</Hydrate>
```

Use this distinction deliberately. Await when the resource is required for the
first hydrated render. Fire and forget when the resource is only a helpful
head start.

## Fallbacks

`fallback` is not the placeholder for the initial server-rendered HTML. On the
initial page load, TanStack Start keeps the existing server HTML in place until
the boundary hydrates:

```tsx
<Hydrate when={visible()} fallback={<ReviewsSkeleton />}>
  <Reviews />
</Hydrate>
```

In that example, if `Reviews` was present in the initial HTML document, users
see the server-rendered reviews. They do not see `ReviewsSkeleton` while the
boundary is waiting for `visible()`.

`fallback` is used when the boundary first appears after the app is already
running and there is no existing server HTML for that boundary. Common examples
include client-side navigation, conditionally showing a panel, or opening a tab
whose contents were not in the initial document. In those cases, the boundary
renders on the client, and `fallback` can show while the generated child chunk
or a child `Suspense` is still loading.

With `never()`, initial server HTML remains static and `fallback` is not used.

The compiler removes statically visible `fallback` props from the server bundle.
Prefer passing `fallback` directly, in an inline object spread, or through a
single-use `const` object spread so server builds can strip that UI.

## Correctness And Updates

Deferred hydration is a performance hint for React's initial hydration work.
React may hydrate a deferred boundary earlier than its strategy would normally
allow if state, props, context, or store updates outside the boundary require
React to reconcile inside it before the gate opens. This preserves correctness
and avoids showing stale server HTML after the surrounding app has changed.

`never()` is the exception for initial document hydration. Treat it as
intentionally static SSR HTML. Do not rely on parent updates to make a `never()`
boundary interactive. If the same boundary mounts later during client-side
navigation, it renders normally.

## Nested Boundaries

Nested boundaries hydrate parent-first. A child boundary can only hydrate after
its ancestor boundaries have hydrated. That means non-interaction child
strategies such as `visible`, `media`, `idle`, or `condition` cannot run while
their parent boundary is still dehydrated.

For example, a product page might defer the whole reviews section until it is
near the viewport, while keeping heavier review tools cold until the user
interacts with them:

```tsx
import { Hydrate } from '@tanstack/react-start'
import { interaction, visible } from '@tanstack/react-start/hydration'

export function ProductPage() {
  return (
    <>
      <ProductHero />
      <BuyBox />

      <Hydrate when={visible({ rootMargin: '600px' })}>
        <section aria-labelledby="reviews-heading">
          <h2 id="reviews-heading">Reviews</h2>
          <ReviewsSummary />
          <ReviewsList />

          <Hydrate when={interaction({ events: ['focusin', 'click'] })}>
            <ReviewFilters />
          </Hydrate>

          <Hydrate when={interaction({ events: 'click' })}>
            <WriteReviewForm />
          </Hydrate>
        </section>
      </Hydrate>
    </>
  )
}
```

In this example, scrolling near the reviews hydrates the parent first. Only
after that can the nested interaction boundaries hydrate from focus or click.

Interaction intent can also resolve an unresolved ancestor chain when the
ancestor is itself waiting for interaction:

```tsx
<Hydrate when={interaction({ events: ['focusin', 'click'] })}>
  <section aria-label="Review tools">
    <ReviewSortSummary />

    <Hydrate when={interaction({ events: 'click' })}>
      <WriteReviewForm />
    </Hydrate>
  </section>
</Hydrate>
```

If the first meaningful intent is a click inside `WriteReviewForm`, TanStack
Start hydrates the unresolved parent chain and then redispatches a same-type
event for the target boundary. Native listener payload details such as pointer
coordinates are not guaranteed to be preserved. A `never()` ancestor still wins
during initial hydration, so descendants under it remain non-interactive.

## Preloading And CSS

Transformed `Hydrate` JavaScript chunks are not modulepreloaded with the route.
Without `prefetch`, the child chunk loads when the split boundary is ready to
render. If that import suspends during client-side navigation or another
client-only mount, the boundary's `fallback` is shown.

CSS used by split, deferred, and `never()` boundaries is linked in the SSR HTML
for the matched route. It is not deferred with the generated child JavaScript
chunk, because the server-rendered HTML may need those styles before any
JavaScript runs. This is route-level asset linking: if a route module contains a
deferred boundary that imports CSS, that stylesheet can be linked for the route
even when that boundary is hidden behind conditional rendering and does not
appear in a particular response.

## Extraction Limits

Compiler-backed `Hydrate` splitting works by moving the boundary's children into
a generated virtual module and rendering them through a lazy component. That
gives TanStack Start a separate child chunk to load later, but it also means the
compiler must be able to move the JSX safely.

Keep the component you want to split directly inside `Hydrate`. If you hide it
behind opaque `children` props, the compiler cannot statically extract those
children into a generated child chunk at the usage site.

The split boundary must use a statically imported `Hydrate` component from
`@tanstack/react-start`. Renaming that import is supported:

```tsx
import { Hydrate as Deferred } from '@tanstack/react-start'

export function ProductPage() {
  return (
    <Deferred when={visible()}>
      <Reviews />
    </Deferred>
  )
}
```

Assigning `Hydrate` to another component variable is not analyzed for splitting:

```tsx
import { Hydrate } from '@tanstack/react-start'

const Deferred = Hydrate

<Deferred when={visible()}>
  <Reviews />
</Deferred>
```

Render the imported `Hydrate` tag directly, use an import rename, or set
`split={false}` when you need component indirection.

Use the literal prop `split={false}` to opt out of extraction. Dynamic values
such as `split={shouldSplit}` cannot be used to opt out at compile time.

These patterns cannot be split:

| Pattern                                  | Why it is rejected                                                                 | What to do instead                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Function-as-children                     | The compiler cannot move a render function and preserve the expected call pattern. | Use `split={false}` or move the rendered UI into a child component.                  |
| Hook calls directly inside extracted JSX | Moving that JSX would move where the hook executes.                                | Move the hook call into a component inside the boundary, then render that component. |
| `this` captures                          | Extracted function components cannot safely preserve class instance context.       | Wrap the UI in a function component or use `split={false}`.                          |
| `super` captures                         | Extracted function components cannot preserve superclass access.                   | Wrap the UI in a function component or use `split={false}`.                          |

This fails because `useThing()` would be moved into the generated component:

```tsx
<Hydrate when={idle()}>
  <p>{useThing()}</p>
</Hydrate>
```

Move the hook into a component instead:

```tsx
function ThingText() {
  const thing = useThing()
  return <p>{thing}</p>
}

export function ProductPage() {
  return (
    <Hydrate when={idle()}>
      <ThingText />
    </Hydrate>
  )
}
```

Values captured from the surrounding component can be passed into the generated
child component, but keep the boundary simple. If extraction starts forcing
complicated data flow, prefer a named child component and put the logic there.

`fallback` stripping is intentionally conservative. The server build can strip
directly passed fallback UI, inline object-spread fallback UI, and single-use
`const` object-spread fallback UI. If fallback props are hidden behind dynamic
spreads or shared objects, the compiler may keep them.

You can extract reusable `when` and `prefetch` helpers today, but avoid hiding
split boundaries behind plain wrapper components if you need child code
splitting. A wrapper can defer hydration at runtime, but the compiler cannot
reliably move call-site children into a separate chunk through arbitrary
component indirection.
