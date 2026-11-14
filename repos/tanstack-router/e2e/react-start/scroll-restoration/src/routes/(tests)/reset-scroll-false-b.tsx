import { createFileRoute } from '@tanstack/react-router'
import { ResetScrollFalseList } from '../-components/reset-scroll-false-list'

export const Route = createFileRoute('/(tests)/reset-scroll-false-b')({
  component: Component,
})

function Component() {
  return (
    <div className="p-2">
      <h3>reset-scroll-false-b</h3>
      <ResetScrollFalseList to="/reset-scroll-false-c" />
    </div>
  )
}
