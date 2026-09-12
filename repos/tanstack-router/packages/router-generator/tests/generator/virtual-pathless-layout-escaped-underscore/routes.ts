import { index, layout, rootRoute, route } from '@tanstack/virtual-file-routes'

export const routes = rootRoute('__root.tsx', [
  route('/_foo', 'foo.tsx'),
  route('/[_]escaped', 'escaped.tsx'),
  route('/__double', 'double.tsx'),
  route('/_root-index', [index('root-index.tsx'), route('$id', 'root-id.tsx')]),
  layout('_layout', 'layout.tsx', [
    route('/_bar', 'bar.tsx'),
    route('/[_]escaped-bar', 'escaped-bar.tsx'),
    route('/__double-bar', 'double-bar.tsx'),
    route('/_nested-index', [
      index('nested-index.tsx'),
      route('$id', 'nested-id.tsx'),
    ]),
    route('/[_]escaped-index', [
      index('escaped-index.tsx'),
      route('$id', 'escaped-id.tsx'),
    ]),
    route('/__double-index', [
      index('double-index.tsx'),
      route('$id', 'double-id.tsx'),
    ]),
    route('/trail_', [index('trail-index.tsx')]),
    layout('_nested', 'nested-layout.tsx', [route('/_baz', 'baz.tsx')]),
    layout('_inner', 'inner-layout.tsx', [
      route('/_deep-index', [index('deep-index.tsx')]),
    ]),
  ]),
])
