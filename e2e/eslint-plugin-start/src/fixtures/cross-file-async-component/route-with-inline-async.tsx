// Route with inline arrow function that renders async component
import { createFileRoute } from '@tanstack/react-router'
import { InlineAsyncComponent } from './inline-async-component'

export const Route = createFileRoute(undefined)({
  component: () => <InlineAsyncComponent />,
})
