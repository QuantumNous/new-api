---
title: Link Options
---

You may want to reuse options that are intended to be passed to `Link`, `redirect` or `navigate`. In which case you may decide an object literal is a good way to represent options passed to `Link`.

```tsx
const dashboardLinkOptions = {
  to: '/dashboard',
  search: { search: '' },
}

function DashboardComponent() {
  return <Link {...dashboardLinkOptions} />
}
```

There are a few problems here. `dashboardLinkOptions.to` is inferred as `string` which by default will resolve to every route when passed to `Link`, `navigate` or `redirect` (this particular issue could be fixed by `as const`). The other issue here is we do not know `dashboardLinkOptions` even passes the type checker until it is spread into `Link`. We could very easily create incorrect navigation options and only when the options are spread into `Link` do we know there is a type error.

### Using `linkOptions` function to create re-usable options

`linkOptions` is a function which type checks an object literal and returns the inferred input as is. This provides type safety on options exactly like `Link` before it is used allowing for easier maintenance and re-usability. Our above example using `linkOptions` looks like this:

```tsx
const dashboardLinkOptions = linkOptions({
  to: '/dashboard',
  search: { search: '' },
})

function DashboardComponent() {
  return <Link {...dashboardLinkOptions} />
}
```

This allows eager type checking of `dashboardLinkOptions` which can then be re-used anywhere

```tsx
const dashboardLinkOptions = linkOptions({
  to: '/dashboard',
  search: { search: '' },
})

export const Route = createFileRoute('/dashboard')({
  component: DashboardComponent,
  validateSearch: (input) => ({ search: input.search }),
  beforeLoad: () => {
    // can used in redirect
    throw redirect(dashboardLinkOptions)
  },
})

function DashboardComponent() {
  const navigate = useNavigate()

  return (
    <div>
      {/** can be used in navigate */}
      <button onClick={() => navigate(dashboardLinkOptions)} />

      {/** can be used in Link */}
      <Link {...dashboardLinkOptions} />
    </div>
  )
}
```

### An array of `linkOptions`

When creating navigation you might loop over an array to construct a navigation bar. In which case `linkOptions` can be used to type check an array of object literals which are intended for `Link` props

```tsx
const options = linkOptions([
  {
    to: '/dashboard',
    label: 'Summary',
    activeOptions: { exact: true },
  },
  {
    to: '/dashboard/invoices',
    label: 'Invoices',
  },
  {
    to: '/dashboard/users',
    label: 'Users',
  },
])

function DashboardComponent() {
  return (
    <>
      <div className="flex items-center border-b">
        <h2 className="text-xl p-2">Dashboard</h2>
      </div>

      <div className="flex flex-wrap divide-x">
        {options.map((option) => {
          return (
            <Link
              {...option}
              key={option.to}
              activeProps={{ className: `font-bold` }}
              className="p-2"
            >
              {option.label}
            </Link>
          )
        })}
      </div>
      <hr />

      <Outlet />
    </>
  )
}
```

The input of `linkOptions` is inferred and returned, as shown with the use of `label` as this does not exist on `Link` props
