import { index, physical, rootRoute } from '@tanstack/virtual-file-routes'

export const routes = rootRoute('__root.tsx', [
  index('index.tsx'),
  physical('/s1', '../subtree/routes'),
])
