import { redirect, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute(
  '/$project/$version/docs/framework/$framework/',
)({
  beforeLoad: () => {
    throw redirect({
      from: '/$project/$version/docs/framework/$framework/',
      to: '/$project/$version/docs/framework/$framework/$',
      params: {
        _splat: 'overview',
      },
    })
  },
})
