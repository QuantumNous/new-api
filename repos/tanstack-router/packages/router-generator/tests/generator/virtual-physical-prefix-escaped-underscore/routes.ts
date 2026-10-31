import { physical, rootRoute } from '@tanstack/virtual-file-routes'

export const routes = rootRoute('__root.tsx', [
  physical('/[_]api', 'physical-routes'),
])
