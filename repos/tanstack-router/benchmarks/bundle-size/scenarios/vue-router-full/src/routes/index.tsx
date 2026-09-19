import {
  createFileRoute,
  retainSearchParams,
  stripSearchParams,
} from '@tanstack/vue-router'

const defaultSearch = { page: 1 }

export const Route = createFileRoute('/')({
  search: {
    middlewares: [
      retainSearchParams<Record<string, unknown>>(['persist']),
      stripSearchParams(defaultSearch),
    ],
  },
  component: IndexComponent,
})

function IndexComponent() {
  return <div>hello world</div>
}
