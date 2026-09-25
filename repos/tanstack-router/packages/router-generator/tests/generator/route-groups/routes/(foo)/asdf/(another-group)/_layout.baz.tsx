import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/(foo)/asdf/(another-group)/_layout/baz')(
  {
    component: () => <div>Hello /(foo)/asdf/(another-group)/_layout/baz!</div>,
  },
)
