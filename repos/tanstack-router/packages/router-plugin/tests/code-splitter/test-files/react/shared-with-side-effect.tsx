import { createFileRoute } from '@tanstack/react-router'

const registry = new Map()
console.log('registry created')

export const Route = createFileRoute('/fx')({
  loader: async () => {
    registry.set('loaded', true)
  },
  component: () => <div>{registry.size}</div>,
})
