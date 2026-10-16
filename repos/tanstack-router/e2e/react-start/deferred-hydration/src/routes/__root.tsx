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
      { title: 'Deferred Hydration E2E' },
    ],
  }),
  shellComponent: RootDocument,
  component: () => (
    <main>
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
              radial-gradient(circle at 10% 0%, rgba(14, 165, 233, 0.22), transparent 32rem),
              radial-gradient(circle at 90% 10%, rgba(168, 85, 247, 0.2), transparent 28rem),
              linear-gradient(135deg, #f8fafc 0%, #eef2ff 52%, #ecfeff 100%);
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          nav {
            position: sticky;
            top: 0;
            z-index: 10;
            display: flex;
            gap: 0.75rem;
            align-items: center;
            padding: 1rem clamp(1rem, 4vw, 3rem);
            border-bottom: 1px solid rgba(99, 102, 241, 0.16);
            background: rgba(255, 255, 255, 0.78);
            backdrop-filter: blur(16px);
          }
          nav a {
            padding: 0.55rem 0.8rem;
            border-radius: 999px;
            color: #312e81;
            text-decoration: none;
            font-weight: 800;
          }
          main { width: min(1100px, calc(100vw - 2rem)); margin: 0 auto; padding: 2rem 0 4rem; }
          .dh-page { display: grid; gap: 1rem; }
          .dh-hero {
            padding: clamp(1.5rem, 4vw, 3rem);
            border: 1px solid rgba(99, 102, 241, 0.18);
            border-radius: 2rem;
            background: rgba(255, 255, 255, 0.78);
            box-shadow: 0 24px 80px rgba(67, 56, 202, 0.14);
          }
          .dh-hero h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.75rem); line-height: 0.95; letter-spacing: -0.08em; color: #1e1b4b; }
          .dh-hero p { max-width: 68ch; color: #475569; line-height: 1.7; }
          .dh-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; }
          .dh-card {
            display: grid;
            gap: 0.7rem;
            align-content: start;
            padding: 1.1rem;
            min-height: 150px;
            border: 1px solid rgba(15, 23, 42, 0.1);
            border-radius: 1.25rem;
            background: rgba(255, 255, 255, 0.82);
            box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08);
          }
          .dh-card h2 { margin: 0; color: #312e81; }
          .dh-card p { margin: 0; color: #64748b; line-height: 1.55; }
          .dh-card button {
            width: fit-content;
            border: 0;
            border-radius: 999px;
            padding: 0.7rem 1rem;
            background: #4f46e5;
            color: white;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(79, 70, 229, 0.24);
          }
          .dh-card button:hover { background: #4338ca; }
          .dh-badge { width: fit-content; padding: 0.25rem 0.55rem; border-radius: 999px; background: #312e81; color: white; font-size: 0.72rem; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; }
          .dh-guide {
            display: grid;
            gap: 0.65rem;
            padding: 1rem;
            border: 1px solid rgba(14, 165, 233, 0.22);
            border-radius: 1.25rem;
            background: rgba(240, 249, 255, 0.82);
            color: #0f172a;
          }
          .dh-guide strong { color: #075985; }
          .dh-note {
            margin: 1rem 0 0.4rem;
            padding: 0.8rem 1rem;
            border-left: 5px solid #4f46e5;
            border-radius: 0.8rem;
            background: rgba(255, 255, 255, 0.72);
            color: #475569;
            line-height: 1.55;
          }
          .dh-note strong { color: #312e81; }
          .dh-spacer {
            display: grid;
            place-items: center;
            height: 120vh;
            margin: 1rem 0;
            border: 1px dashed rgba(79, 70, 229, 0.32);
            border-radius: 1.5rem;
            color: #4338ca;
            background: linear-gradient(180deg, rgba(238, 242, 255, 0.55), rgba(240, 253, 250, 0.75));
            font-weight: 800;
          }
          [data-testid^="component-"][data-testid$="-button"] {
            border: 0;
            border-radius: 999px;
            padding: 0.65rem 0.95rem;
            margin: 0.2rem 0.25rem 0.2rem 0;
            background: #4f46e5;
            color: white;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 10px 28px rgba(79, 70, 229, 0.22);
          }
          [data-testid^="enhanced-"][data-testid$="-button"] {
            border: 0;
            border-radius: 999px;
            padding: 0.65rem 0.95rem;
            margin: 0.2rem 0.25rem 0.2rem 0;
            background: #4f46e5;
            color: white;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 10px 28px rgba(79, 70, 229, 0.22);
          }
          [data-testid^="component-"][data-testid$="-button"][data-hydrated="false"] { background: #be185d; }
          [data-testid^="component-"][data-testid$="-button"][data-hydrated="true"] { background: #047857; }
          [data-testid^="enhanced-"][data-testid$="-button"][data-hydrated="false"] { background: #be185d; }
          [data-testid^="enhanced-"][data-testid$="-button"][data-hydrated="true"] { background: #047857; }
          .dh-visible { min-height: 75vh; align-content: end; background: linear-gradient(135deg, rgba(219, 234, 254, 0.9), rgba(255,255,255,0.88)); }
          .dh-never { background: linear-gradient(135deg, rgba(254, 226, 226, 0.88), rgba(255,255,255,0.88)); }
          .dh-css { background: linear-gradient(135deg, rgba(220, 252, 231, 0.9), rgba(255,255,255,0.88)); }
        `}</style>
      </head>
      <body>
        <nav>
          <Link to="/">Home</Link> <Link to="/components">Component</Link>{' '}
          <Link to="/css">CSS</Link>{' '}
          <Link to="/imported" preload="intent">
            Imported
          </Link>
          <Link to="/enhanced" search={{ dynamic: 'interaction' }}>
            Enhanced
          </Link>
          <Link to="/scroll-restoration">Scroll</Link>
        </nav>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
