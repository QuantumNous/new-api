import {
  defineVirtualSubtreeConfig,
  index,
  physical,
  route,
} from '@tanstack/virtual-file-routes'

// this just shows that you can use an async function to define your virtual routes
export default defineVirtualSubtreeConfig(async () => [
  index('home.tsx'),
  route('$postId', 'details.tsx'),
  physical('/inception', 'lets-go'),
])
