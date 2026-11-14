---
id: type-utilities
title: Type Utilities
---

Most types exposed by TanStack Router are internal, subject to breaking changes and not always easy to use. That is why TanStack Router has a subset of exposed types focused on ease of use with the intension to be used externally. These types provide the same type safe experience from TanStack Router's runtime concepts on the type level, with flexibility of where to provide type checking

## Type checking Link options with `ValidateLinkOptions`

`ValidateLinkOptions` type checks object literal types to ensure they conform to `Link` options at inference sites. For example, you may have a generic `HeadingLink` component which accepts a `title` prop along with `linkOptions`, the idea being this component can be re-used for any navigation.

<!-- ::start:framework -->

# React

```tsx
export interface HeaderLinkProps<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
> {
  title: string
  linkOptions: ValidateLinkOptions<TRouter, TOptions>
}

export function HeadingLink<TRouter extends RegisteredRouter, TOptions>(
  props: HeaderLinkProps<TRouter, TOptions>,
): React.ReactNode
export function HeadingLink(props: HeaderLinkProps): React.ReactNode {
  return (
    <>
      <h1>{props.title}</h1>
      <Link {...props.linkOptions} />
    </>
  )
}
```

# Solid

```tsx
export interface HeaderLinkProps<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
> {
  title: string
  linkOptions: ValidateLinkOptions<TRouter, TOptions>
}

export function HeadingLink<TRouter extends RegisteredRouter, TOptions>(
  props: HeaderLinkProps<TRouter, TOptions>,
): Solid.JSX.Element
export function HeadingLink(props: HeaderLinkProps): Solid.JSX.Element {
  return (
    <>
      <h1>{props.title}</h1>
      <Link {...props.linkOptions} />
    </>
  )
}
```

<!-- ::end:framework -->

A more permissive overload of `HeadingLink` is used to avoid type assertions you would otherwise have to do with the generic signature. Using a looser signature without type parameters is an easy way to avoid type assertions in the implementation of `HeadingLink`

All type parameters for utilities are optional but for the best TypeScript performance `TRouter` should always be specified for the public facing signature. And `TOptions` should always be used at inference sites like `HeadingLink` to infer the `linkOptions` to correctly narrow `params` and `search`

The result of this is that `linkOptions` in the following is completely type-safe

```tsx
<HeadingLink title="Posts" linkOptions={{ to: '/posts' }} />
<HeadingLink title="Post" linkOptions={{ to: '/posts/$postId', params: {postId: 'postId'} }} />
```

## Type checking an array of Link options with `ValidateLinkOptionsArray`

All navigation type utilities have an array variant. `ValidateLinkOptionsArray` enables type checking of an array of `Link` options. For example, you might have a generic `Menu` component where each item is a `Link`.

<!-- ::start:framework -->

# React

```tsx
export interface MenuProps<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TItems extends ReadonlyArray<unknown> = ReadonlyArray<unknown>,
> {
  items: ValidateLinkOptionsArray<TRouter, TItems>
}

export function Menu<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TItems extends ReadonlyArray<unknown>,
>(props: MenuProps<TRouter, TItems>): React.ReactNode
export function Menu(props: MenuProps): React.ReactNode {
  return (
    <ul>
      {props.items.map((item) => (
        <li>
          <Link {...item} />
        </li>
      ))}
    </ul>
  )
}
```

# Solid

```tsx
import { For } from 'solid-js'

export interface MenuProps<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TItems extends ReadonlyArray<unknown> = ReadonlyArray<unknown>,
> {
  items: ValidateLinkOptionsArray<TRouter, TItems>
}

export function Menu<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TItems extends ReadonlyArray<unknown>,
>(props: MenuProps<TRouter, TItems>): Solid.JSX.Element
export function Menu(props: MenuProps): Solid.JSX.Element {
  return (
    <ul>
      <For each={props.items}>
        {(item) => (
          <li>
            <Link {...item} />
          </li>
        )}
      </For>
    </ul>
  )
}
```

<!-- ::end:framework -->

This of course allows the following `items` prop to be completely type-safe

```tsx
<Menu
  items={[
    { to: '/posts' },
    { to: '/posts/$postId', params: { postId: 'postId' } },
  ]}
/>
```

It is also possible to fix `from` for each `Link` options in the array. This would allow all `Menu` items to navigate relative to `from`. Additional type checking of `from` can be provided by the `ValidateFromPath` utility

<!-- ::start:framework -->

# React

```ts
export interface MenuProps<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TItems extends ReadonlyArray<unknown> = ReadonlyArray<unknown>,
  TFrom extends string = string,
> {
  from: ValidateFromPath<TRouter, TFrom>
  items: ValidateLinkOptionsArray<TRouter, TItems, TFrom>
}

export function Menu<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TItems extends ReadonlyArray<unknown>,
  TFrom extends string = string,
>(props: MenuProps<TRouter, TItems, TFrom>): React.ReactNode
export function Menu(props: MenuProps): React.ReactNode {
  return (
    <ul>
      {props.items.map((item) => (
        <li>
          <Link {...item} from={props.from} />
        </li>
      ))}
    </ul>
  )
}
```

# Solid

```ts
import { For } from 'solid-js'

export interface MenuProps<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TItems extends ReadonlyArray<unknown> = ReadonlyArray<unknown>,
  TFrom extends string = string,
> {
  from: ValidateFromPath<TRouter, TFrom>
  items: ValidateLinkOptionsArray<TRouter, TItems, TFrom>
}

export function Menu<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TItems extends ReadonlyArray<unknown>,
  TFrom extends string = string,
>(props: MenuProps<TRouter, TItems, TFrom>): Solid.JSX.Element
export function Menu(props: MenuProps): Solid.JSX.Element {
  return (
    <ul>
      <For each={props.items}>
        {(item) => (
          <li>
            <Link {...item} from={props.from} />
          </li>
        )}
      </For>
    </ul>
  )
}
```

<!-- ::end:framework -->

`ValidateLinkOptionsArray` allows you to fix `from` by providing an extra type parameter. The result is a type safe array of `Link` options providing navigation relative to `from`

```tsx
<Menu
  from="/posts"
  items={[{ to: '.' }, { to: './$postId', params: { postId: 'postId' } }]}
/>
```

## Type checking redirect options with `ValidateRedirectOptions`

`ValidateRedirectOptions` type checks object literal types to ensure they conform to redirect options at inference sites. For example, you may need a generic `fetchOrRedirect` function which accepts a `url` along with `redirectOptions`, the idea being this function will redirect when the `fetch` fails.

```tsx
export async function fetchOrRedirect<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions,
>(
  url: string,
  redirectOptions: ValidateRedirectOptions<TRouter, TOptions>,
): Promise<unknown>
export async function fetchOrRedirect(
  url: string,
  redirectOptions: ValidateRedirectOptions,
): Promise<unknown> {
  const response = await fetch(url)

  if (!response.ok && response.status === 401) {
    throw redirect(redirectOptions)
  }

  return await response.json()
}
```

The result is that `redirectOptions` passed to `fetchOrRedirect` is completely type-safe

```tsx
fetchOrRedirect('http://example.com/', { to: '/login' })
```

## Type checking navigate options with `ValidateNavigateOptions`

`ValidateNavigateOptions` type checks object literal types to ensure they conform to navigate options at inference sites. For example, you may want to write a custom hook to enable/disable navigation.

<!-- ::start:framework -->

# React

```tsx
export interface UseConditionalNavigateResult {
  enable: () => void
  disable: () => void
  navigate: () => void
}

export function useConditionalNavigate<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions,
>(
  navigateOptions: ValidateNavigateOptions<TRouter, TOptions>,
): UseConditionalNavigateResult
export function useConditionalNavigate(
  navigateOptions: ValidateNavigateOptions,
): UseConditionalNavigateResult {
  const [enabled, setEnabled] = useState(false)
  const navigate = useNavigate()
  return {
    enable: () => setEnabled(true),
    disable: () => setEnabled(false),
    navigate: () => {
      if (enabled) {
        navigate(navigateOptions)
      }
    },
  }
}
```

# Solid

```tsx
import { createSignal } from 'solid-js'

export interface UseConditionalNavigateResult {
  enable: () => void
  disable: () => void
  navigate: () => void
}

export function useConditionalNavigate<
  TRouter extends RegisteredRouter = RegisteredRouter,
  TOptions = unknown,
>(
  navigateOptions: ValidateNavigateOptions<TRouter, TOptions>,
): UseConditionalNavigateResult
export function useConditionalNavigate(
  navigateOptions: ValidateNavigateOptions,
): UseConditionalNavigateResult {
  const [enabled, setEnabled] = createSignal(false)
  const navigate = useNavigate()
  return {
    enable: () => setEnabled(true),
    disable: () => setEnabled(false),
    navigate: () => {
      if (enabled()) {
        navigate(navigateOptions)
      }
    },
  }
}
```

<!-- ::end:framework -->

The result of this is that `navigateOptions` passed to `useConditionalNavigate` is completely type-safe and we can enable/disable navigation based on react state

```tsx
const { enable, disable, navigate } = useConditionalNavigate({
  to: '/posts/$postId',
  params: { postId: 'postId' },
})
```
