import { createFileRoute } from '@tanstack/react-router'

const cache = new Map()
function getCached(key: string) {
  return cache.get(key)
}
function setCached(key: string, val: unknown) {
  cache.set(key, val)
}

export const Route = createFileRoute('/cached')({
  loader: async () => {
    setCached('data', await fetch('/api').then((r) => r.json()))
    return getCached('data')
  },
  component: () => <div>{JSON.stringify(getCached('data'))}</div>,
})
