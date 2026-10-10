import { createFileRoute } from '@tanstack/react-router'
import { ScrollBlock } from '../-components/scroll-block'
import { sleep } from '~/utils/posts'

export const Route = createFileRoute('/(tests)/with-loader')({
  loader: async () => {
    await sleep(1000)
    return { foo: 'bar' }
  },
  component: Component,
})

function Component() {
  return (
    <div className="p-2">
      <h3>lazy-with-loader-page</h3>
      <hr />
      <ScrollBlock />
    </div>
  )
}
