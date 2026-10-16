import { createFileRoute } from '@tanstack/react-router'

class DataStore {
  data = new Map()
  get(k: string) {
    return this.data.get(k)
  }
  set(k: string, v: unknown) {
    this.data.set(k, v)
  }
}
const store = new DataStore()

export const Route = createFileRoute('/store')({
  loader: async () => {
    store.set('items', await fetch('/api'))
  },
  component: () => <div>{store.get('items')}</div>,
})
