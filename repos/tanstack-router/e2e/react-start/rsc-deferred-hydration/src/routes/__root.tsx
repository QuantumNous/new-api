/// <reference types="vite/client" />
import * as React from 'react'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'RSC Deferred Hydration E2E' },
    ],
  }),
  shellComponent: RootDocument,
  component: () => (
    <main className="app-shell">
      <Outlet />
    </main>
  ),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
        <style>{`
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            color: #172033;
            background:
              radial-gradient(circle at top left, rgba(79, 70, 229, 0.22), transparent 34rem),
              linear-gradient(135deg, #f8fafc 0%, #eef2ff 44%, #ecfeff 100%);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          a { color: inherit; }
          nav {
            position: sticky;
            top: 0;
            z-index: 10;
            display: flex;
            gap: 0.75rem;
            align-items: center;
            padding: 1rem clamp(1rem, 4vw, 3rem);
            border-bottom: 1px solid rgba(99, 102, 241, 0.18);
            background: rgba(255, 255, 255, 0.78);
            backdrop-filter: blur(16px);
          }
          nav a {
            padding: 0.55rem 0.8rem;
            border-radius: 999px;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 700;
          }
          nav a:hover { background: rgba(79, 70, 229, 0.1); }
          .brand { margin-right: auto; font-weight: 900; letter-spacing: -0.04em; color: #312e81; }
          .app-shell { width: min(1100px, calc(100vw - 2rem)); margin: 0 auto; padding: 2rem 0 4rem; }
          .hero {
            padding: clamp(1.5rem, 4vw, 3rem);
            border: 1px solid rgba(99, 102, 241, 0.18);
            border-radius: 2rem;
            background: rgba(255, 255, 255, 0.76);
            box-shadow: 0 24px 80px rgba(67, 56, 202, 0.14);
          }
          .hero h1 { margin: 0; font-size: clamp(2rem, 6vw, 4rem); line-height: 0.95; letter-spacing: -0.08em; color: #1e1b4b; }
          .hero p { max-width: 62ch; color: #475569; line-height: 1.7; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
          .card {
            padding: 1.25rem;
            border: 1px solid rgba(15, 23, 42, 0.1);
            border-radius: 1.25rem;
            background: rgba(255, 255, 255, 0.8);
            box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
          }
          .card strong { display: block; margin-bottom: 0.35rem; color: #312e81; }
          .strategy-card {
            display: grid;
            gap: 0.75rem;
            padding: 1.25rem;
            border-radius: 1.25rem;
            border: 1px solid rgba(99, 102, 241, 0.18);
            background: linear-gradient(135deg, rgba(255,255,255,0.92), rgba(238,242,255,0.92));
          }
          .server-frame { border-color: rgba(14, 165, 233, 0.35); background: linear-gradient(135deg, rgba(240, 249, 255, 0.96), rgba(255,255,255,0.9)); }
          .client-frame { border-color: rgba(236, 72, 153, 0.35); background: linear-gradient(135deg, rgba(253, 242, 248, 0.96), rgba(255,255,255,0.9)); }
          .badge { width: fit-content; padding: 0.25rem 0.55rem; border-radius: 999px; background: #312e81; color: white; font-size: 0.72rem; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; }
          button {
            width: fit-content;
            border: 0;
            border-radius: 999px;
            padding: 0.7rem 1rem;
            background: #4f46e5;
            color: white;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(79, 70, 229, 0.28);
          }
          button:hover { background: #4338ca; }
        `}</style>
      </head>
      <body>
        <nav>
          <span className="brand">RSC Deferred Hydration</span>
          <Link to="/">Home</Link>
          <Link to="/server-client">Server Client</Link>
          <Link to="/composite">Composite</Link>
          <Link to="/css">CSS Modules</Link>
        </nav>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
