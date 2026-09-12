import { layout, physical, rootRoute } from '@tanstack/virtual-file-routes'

export const routes = rootRoute('__root.tsx', [
  layout('_layout', 'layout.tsx', [physical('', 'physical-routes')]),
])
