import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="p-2 [view-transition-name:main-content]">
      <h3>Welcome To The View Transitions Example!</h3>
      <div className="flex justify-center mt-4">
        <Link
          to={'/how-it-works'}
          // see styles.css for 'slide-left' transition
          viewTransition={{ types: ['slide-left'] }}
          className="font-bold"
        >
          Next Page -&gt;
        </Link>
      </div>
    </div>
  )
}
