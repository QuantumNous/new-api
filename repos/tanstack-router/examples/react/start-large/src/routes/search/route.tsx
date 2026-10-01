import { createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'

const search = v.object({
  rootSearch: v.number(),
})

export const Route = createFileRoute('/search')({
  component: () => <div>Hello /search!</div>,
  validateSearch: search,
})
