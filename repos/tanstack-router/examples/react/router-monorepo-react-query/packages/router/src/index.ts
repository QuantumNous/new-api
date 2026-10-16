import { queryClient, router } from './router'

export type { RouterType, RouterIds } from './router'

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export { router, queryClient }

// By re exporting the api from TanStack router, we can enforce that other packages
// rely on this one instead, making the type register being applied
export {
  Outlet,
  Link,
  useRouteContext,
  useRouter,
  RouterProvider,
  getRouteApi,
  ErrorComponent,
} from '@tanstack/react-router'
export type { ErrorComponentProps } from '@tanstack/react-router'
