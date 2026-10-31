// Route file that uses an async component from another file
// Should error because AsyncComponent is async and used in client context
import { createFileRoute } from '@tanstack/react-router'
import { AsyncComponent } from './async-component'

export const Route = createFileRoute(undefined)({
  component: AsyncComponent,
})
