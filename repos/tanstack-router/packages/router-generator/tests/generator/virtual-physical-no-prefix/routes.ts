import { physical, rootRoute, route } from '@tanstack/virtual-file-routes'

// This test verifies the single-argument physical() overload
// which uses an empty path prefix (merges at current level)
export const routes = rootRoute('__root.tsx', [
  route('/about', 'about.tsx'),
  physical('merged'), // Single argument - merges at root
])
