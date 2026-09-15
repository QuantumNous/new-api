import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/_pathlessLayout/settings')({
  component: () => <div>Settings</div>,
})
