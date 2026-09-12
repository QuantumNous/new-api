import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(foo)/asdf/(bar)/_layout')({
  component: () => <div>Hello /(foo)/asdf/(bar)/_layout!</div>,
})
