import fs from 'node:fs'
import { useRouter, createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'

const filePath = 'count.txt'

const getCount = createServerFn({
  method: 'GET',
}).handler(async () => {
  const number = await fs.promises.readFile(filePath, 'utf-8').catch(() => '0')
  return parseInt(number || '0')
})

const updateCount = createServerFn({ method: 'POST' })
  .validator((d: number) => d)
  .handler(async ({ data }) => {
    const count = await getCount()
    await fs.promises.writeFile(filePath, `${count + data}`)
  })
export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => await getCount(),
})

function Home() {
  const router = useRouter()
  const state = Route.useLoaderData()

  return (
    <button
      data-testid="add-button"
      onClick={() => {
        updateCount({ data: 1 }).then(() => {
          router.invalidate()
        })
      }}
    >
      Add 1 to {state()}?
    </button>
  )
}
