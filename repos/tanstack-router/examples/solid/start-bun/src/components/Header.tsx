import { Link } from '@tanstack/solid-router'

export default function Header() {
  return (
    <header class="p-2 flex gap-2 bg-white text-black justify-between">
      <nav class="flex flex-row">
        <div class="px-2 font-bold">
          <Link to="/">Home</Link>
        </div>

        <div class="px-2 font-bold">
          <Link to="/demo/start/server-funcs">Start - Server Functions</Link>
        </div>

        <div class="px-2 font-bold">
          <Link to="/demo/start/api-request">Start - API Request</Link>
        </div>
      </nav>
    </header>
  )
}
