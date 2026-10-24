import { useState } from 'react'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'

const navItems = [
  { path: '/', label: 'Home', description: 'Overview of all demos' },
  {
    path: '/pokemon-rsc',
    label: 'Pokemon RSC',
    description: 'Async server components',
  },
  {
    path: '/e-commerce',
    label: 'eCommerce Demo',
    description: 'Composite RSC pattern',
  },
  {
    path: '/low-level-api',
    label: 'Low-Level API',
    description: 'RSC primitives',
  },
]

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Toggle navigation menu"
              >
                <svg
                  className="w-6 h-6 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {sidebarOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
              <Link to="/" className="flex items-center gap-2">
                <span className="text-xl font-bold text-gray-900">
                  TanStack RSC Examples
                </span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1">
        {/* Sidebar Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-14 left-0 h-[calc(100vh-3.5rem)] w-64 bg-white border-r border-gray-200 z-40 transform transition-transform duration-200 ease-in-out ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`block px-4 py-3 rounded-lg transition-colors ${
                  currentPath === item.path
                    ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-500'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="font-medium">{item.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {item.description}
                </div>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <Outlet />

          {/* Legend Footer */}
          <footer className="mt-12 py-8 border-t border-gray-200 bg-white">
            <div className="max-w-4xl mx-auto px-4">
              <div className="flex flex-wrap gap-6 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded border-4 border-solid border-blue-500" />
                  <span className="text-gray-600 font-medium">
                    Server Component
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded border-4 border-dashed border-green-500" />
                  <span className="text-gray-600 font-medium">
                    Client Component
                  </span>
                </div>
              </div>
              <p className="text-center text-gray-400 text-sm mt-4">
                TanStack Start RSC Examples
              </p>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
