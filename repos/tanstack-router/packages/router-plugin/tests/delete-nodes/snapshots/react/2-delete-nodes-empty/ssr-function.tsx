import { createFileRoute } from '@tanstack/react-router'
import crypto from 'node:crypto'
export const Route = createFileRoute('/')({
  ssr: () => {
    if (crypto.randomInt(0, 2) === 0) {
      return 'data-only'
    }
    return false
  },
  component: () => {
    return <div className="p-2">hello world</div>
  },
})
