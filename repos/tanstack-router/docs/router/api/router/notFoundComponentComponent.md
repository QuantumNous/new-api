---
id: notFoundComponentComponent
title: NotFoundComponent component
---

The `NotFoundComponent` component is a component that renders when a not-found error occurs in a route.

## NotFoundComponent props

The `NotFoundComponent` component accepts the following props:

### `props.data` prop

- Type: `unknown`
- Optional
- Custom data that is passed to the `notFoundComponent` when the not-found error is handled
- This data comes from the `data` property of the `NotFoundError` object

### `props.isNotFound` prop

- Type: `boolean`
- Required
- A boolean value indicating whether the current state is a not-found error state
- This value is always `true`

### `props.routeId` prop

- Type: `RouteIds<RegisteredRouter['routeTree']>`
- Required
- The ID of the route that is attempting to handle the not-found error
- Must be one of the valid route IDs from the router's route tree

## NotFoundComponent returns

- Returns appropriate UI for not-found error situations
- Typically includes a "page not found" message along with links to go home or navigate to previous pages
