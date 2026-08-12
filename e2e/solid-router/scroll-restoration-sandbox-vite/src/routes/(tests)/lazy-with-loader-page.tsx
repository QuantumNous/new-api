import { createFileRoute } from '@tanstack/solid-router'
import { sleep } from '../../posts'

export const Route = createFileRoute('/(tests)/lazy-with-loader-page')({
  loader: async () => {
    await sleep(1000)
    return { foo: 'bar' }
  },
})
