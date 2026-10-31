import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$validParam')({
  component: () => <div>Valid param</div>,
})
