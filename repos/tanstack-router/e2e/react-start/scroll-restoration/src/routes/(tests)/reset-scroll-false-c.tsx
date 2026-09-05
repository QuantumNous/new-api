import { createFileRoute } from '@tanstack/react-router'
import { ResetScrollFalseList } from '../-components/reset-scroll-false-list'

export const Route = createFileRoute('/(tests)/reset-scroll-false-c')({
  component: Component,
})

function Component() {
  return (
    <div className="p-2">
      <h3>reset-scroll-false-c</h3>
      <ResetScrollFalseList />
    </div>
  )
}
