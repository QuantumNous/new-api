import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router';
import { Home } from './Home';
import { routes } from './routes';
import './index.css';

const baseUrl = import.meta.env.BASE_URL;
const routerBase = baseUrl === '/' ? '' : baseUrl.replace(/\/$/, '');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBase}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

export function App() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link className="flex items-center gap-3 text-lg font-semibold" to="/">
            <img
              src={`${baseUrl}base-ui-logo.svg`}
              alt="Base UI logo"
              className="h-6 w-6 relative -top-0.5"
            />
            Base UI playground
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          {routes.map((entry) => {
            if (entry.type === 'route') {
              return <Route key={entry.path} path={entry.path} element={entry.element} />;
            }

            if (entry.type === 'redirect') {
              return (
                <Route
                  key={entry.path}
                  path={entry.path}
                  element={<Navigate replace to={entry.to} />}
                />
              );
            }

            return null;
          })}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
}

function NotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="text-sm text-gray-700">
        This page doesn&apos;t exist.{' '}
        <Link to="/" className="hover:underline">
          Go home
        </Link>
        .
      </p>
    </div>
  );
}
