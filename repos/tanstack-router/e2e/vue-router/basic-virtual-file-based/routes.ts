import {
  index,
  layout,
  physical,
  rootRoute,
  route,
} from '@tanstack/virtual-file-routes'

export const routes = rootRoute('root.tsx', [
  index('home.tsx'),
  route('/posts', 'posts/posts.tsx', [
    index('posts/posts-home.tsx'),
    route('$postId', 'posts/posts-detail.tsx'),
  ]),
  layout('first', 'layout/first-layout.tsx', [
    layout('second', 'layout/second-layout.tsx', [
      route('/layout-a', 'a.tsx'),
      route('/layout-b', 'b.tsx'),
    ]),
  ]),
  physical('/classic', 'file-based-subtree'),
])
