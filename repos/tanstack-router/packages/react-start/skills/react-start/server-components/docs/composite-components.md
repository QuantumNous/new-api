# Composite Components and slot composition

## The real mechanism

Inside `createCompositeComponent`, slot props are placeholders, not real client elements.

Server-side behavior:

- reading `props.children` records “there will be children here”
- calling `props.renderSomething(args)` records “call this slot with these args later”
- reading a component prop like `props.AddToCart` records “render this client component here with these props later”

Client-side behavior:

- `<CompositeComponent src={...} ... />` replaces those placeholders with the real props you passed at render time

This is why slots are powerful and why some React habits stop working.

## Choose the slot type by data flow

### `children`

Use when:

- the server only needs a hole for client content
- no server data needs to flow into the slotted content
- free-form composition matters more than a rigid interface

Do not use when the server must inject IDs, permissions, pricing, or derived data into the child content.

### render props

Use when:

- the server must pass data into the client-rendered content
- the data is serializable
- you want the call site to stay flexible

This is usually the best default when the server owns the data and the client owns the interactive control.

### component props

Use when:

- you have a reusable client component
- the prop contract is stable
- you want the server to decide where it renders and which typed props it receives

This is a good fit for buttons, menus, controls, widgets, and repeated productized patterns.

## Rules that matter

- `renderServerComponent` does not support slots
- do not use `React.Children.map`, `cloneElement`, or child inspection on the server
- render-prop arguments and component-slot props must be Flight-serializable
- keep slot contracts narrow; pass IDs and plain data, not giant objects by default

## The most common anti-pattern

Bad instinct:

```tsx
createCompositeComponent((props: { children?: React.ReactNode }) => (
  <div>
    {React.Children.map(props.children, (child) =>
      React.cloneElement(child, { extra: 'prop' }),
    )}
  </div>
))
```

Correct rewrite:

```tsx
createCompositeComponent<{
  renderItem?: (data: { extra: string }) => React.ReactNode
}>((props) => <div>{props.renderItem?.({ extra: 'prop' })}</div>)
```

Server-side slot content is opaque. If the server needs to add data, make the data explicit.

## Good slot contracts

Prefer contracts like:

- `renderActions?: ({ postId, authorId }) => ReactNode`
- `AddToCart?: ComponentType<{ productId: string; price: number }>`
- `children?: ReactNode`

Avoid contracts like:

- `renderAnything?: (data: EntirePostRecordFromDB) => ReactNode`
- `children` plus child inspection and mutation
- opaque callbacks that expect non-serializable classes or functions from the server

## Composition patterns that age well

### Shell + actions

The server renders an article, card, or panel and exposes one `renderActions` slot for buttons, menus, or controls.

### Shell + body children

The server renders stable framing UI and accepts `children` for optional interactive regions like comments, drawers, or editors.

### Stable control slot

The server accepts a component prop such as `AddToCart`, `UserMenu`, or `RowActions` and supplies clean typed props to it.

## Refactor heuristics

- No slot use anywhere -> replace the Composite Component with `renderServerComponent`
- Slot exists only to pass data -> prefer a render prop over `children`
- Repeated render-prop call sites with the same component -> promote to a component prop
- Giant slot arg object -> shrink it to the smallest serializable payload that the client really needs
