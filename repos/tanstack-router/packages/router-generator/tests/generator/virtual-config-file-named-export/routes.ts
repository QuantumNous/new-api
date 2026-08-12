import {
  index,
  layout,
  physical,
  rootRoute,
  route,
} from '@tanstack/virtual-file-routes'

export const routes = rootRoute('root.tsx', [
  index('index.tsx'),
  route('$lang', [index('pages.tsx')]),
  layout('layout.tsx', [
    route('/dashboard', 'db/dashboard.tsx', [
      index('db/dashboard-index.tsx'),
      route('/invoices', 'db/dashboard-invoices.tsx', [
        index('db/invoices-index.tsx'),
        route('$id', 'db/invoice-detail.tsx'),
      ]),
    ]),
    physical('/hello', 'subtree'),
  ]),
])
