import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_foo')({
  component: () => 'Foo',
})
