import { Link } from '@tanstack/react-router'
import type { CSSProperties } from 'react'
import type { LinkOptions } from '@tanstack/react-router'

const style = { height: '100px', width: '50%' } satisfies CSSProperties

export function ResetScrollFalseList({ to }: { to?: LinkOptions['to'] }) {
  return Array.from({ length: 100 }, (_, i) => {
    const label = i + 1

    return (
      <div key={label} style={style}>
        <Link
          to={to}
          resetScroll={false}
          data-testid={`reset-scroll-false-link-${label}`}
        >
          {label}
        </Link>
      </div>
    )
  })
}
