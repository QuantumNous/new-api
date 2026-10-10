import { Link } from '@tanstack/solid-router'
import type { JSX } from 'solid-js'

export function NotFound(props?: { children?: JSX.Element }) {
  return (
    <div class="space-y-2 p-2">
      <div>
        {props?.children || 'The page you are looking for does not exist.'}
      </div>
      <p class="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => window.history.back()}
          class="bg-cyan-600 text-white px-2 py-1 rounded-sm uppercase font-black text-sm"
        >
          Go back
        </button>
        <Link
          to="/"
          class="bg-cyan-600 text-white px-2 py-1 rounded-sm uppercase font-black text-sm"
        >
          Start Over
        </Link>
      </p>
    </div>
  )
}
