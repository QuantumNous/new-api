import { createLazyFileRoute } from '@tanstack/react-router'
// @ts-nocheck

export const Route = createLazyFileRoute('/(foo)/asdf/(bar)/_layout/xyz')({
  component: () => <div>Hello /(foo)/asdf/(bar)/_layout/xyz!</div>,
})
