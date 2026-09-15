import { physical, rootRoute, route } from '@tanstack/virtual-file-routes'

// This test verifies that a virtual route path conflicts with
// a physical route path when using empty path prefix
export const routes = rootRoute('__root.tsx', [
  route('/about', 'about.tsx'), // virtual /about
  physical('', 'merged'), // physical also has about.tsx -> /about
])
