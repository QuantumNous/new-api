import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/(foo)/asdf/_layout')({
  component: () => <div>Hello /(foo)/asdf/_layout!</div>,
})
