import { createFileRoute } from '@tanstack/react-router'

const state = { count: 0 }

function getCount() {
  return state.count
}

export const Route = createFileRoute('/shared-indirect')({
  loader: () => {
    state.count++
    return { count: getCount() }
  },
  component: SharedComponent,
})

function SharedComponent() {
  return (
    <div>
      {getCount()} - {state.count}
    </div>
  )
}
