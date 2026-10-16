import { redirect, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/$project/$version/docs/')({
  beforeLoad: () => {
    throw redirect({
      from: '/$project/$version/docs/',
      to: '/$project/$version/docs/framework/$framework/$',
      params: {
        framework: 'vue',
        _splat: 'overview',
      },
    })
  },
})
