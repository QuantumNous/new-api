---
title: Migration from React Router Checklist
toc: false
---

**_If your UI is blank, open the console, and you will probably have some errors that read something along the lines of `cannot use 'useNavigate' outside of context` . This means there are React Router api’s that are still imported and referenced that you need to find and remove. The easiest way to make sure you find all React Router imports is to uninstall `react-router-dom` and then you should get typescript errors in your files. Then you will know what to change to a `@tanstack/react-router` import._**

Here is the [example repo](https://github.com/Benanna2019/SickFitsForEveryone/tree/migrate-to-tanstack/router/React-Router)

- [ ] Install Router - `npm i @tanstack/react-router` (see [detailed installation guide](../how-to/install.md))
- [ ] **Optional:** Uninstall React Router to get TypeScript errors on imports.
  - At this point I don’t know if you can do a gradual migration, but it seems likely you could have multiple router providers, not desirable.
  - The api’s between React Router and TanStack Router are very similar and could most likely be handled in a sprint cycle or two if that is your companies way of doing things.
- [ ] Create Routes for each existing React Router route we have
- [ ] Create root route
- [ ] Create router instance
- [ ] Add global module in main.tsx
- [ ] Remove any React Router (`createBrowserRouter` or `BrowserRouter`), `Routes`, and `Route` Components from main.tsx
- [ ] **Optional:** Refactor `render` function for custom setup/providers - The repo referenced above has an example - This was necessary in the case of Supertokens. Supertoken has a specific setup with React Router and a different setup with all other React implementations
- [ ] Set RouterProvider and pass it the router as the prop
- [ ] Replace all instances of React Router `Link` component with `@tanstack/react-router` `Link` component
  - [ ] Add `to` prop with literal path
  - [ ] Add `params` prop, where necessary with params like so `params={{ orderId: order.id }}`
- [ ] Replace all instances of React Router `useNavigate` hook with `@tanstack/react-router` `useNavigate` hook
  - [ ] Set `to` property and `params` property where needed
- [ ] Replace any React Router `Outlet`'s with the `@tanstack/react-router` equivalent
- [ ] If you are using `useSearchParams` hook from React Router, move the search params default value to the validateSearch property on a Route definition.
  - [ ] Instead of using the `useSearchParams` hook, use `@tanstack/react-router` `Link`'s search property to update the search params state
  - [ ] To read search params you can do something like the following
    - `const { page } = useSearch({ from: productPage.fullPath })`
- [ ] If using React Router’s `useParams` hook, update the import to be from `@tanstack/react-router` and set the `from` property to the literal path name where you want to read the params object from
  - So say we have a route with the path name `orders/$orderid`.
  - In the `useParams` hook we would set up our hook like so: `const params = useParams({ from: "/orders/$orderId" })`
  - Then wherever we wanted to access the order id we would get it off of the params object `params.orderId`
