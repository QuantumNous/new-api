import { Link } from 'react-router';
import { routes } from './routes';

export function Home() {
  return (
    <div className="space-y-3">
      <Nav />
    </div>
  );
}

function Nav() {
  return (
    <ul className="space-y-2 text-sm">
      {routes.map((entry) => {
        if (entry.type === 'header') {
          return (
            <li
              key={entry.label}
              className="pt-2 text-xs font-semibold uppercase tracking-wide text-gray-500"
            >
              {entry.label}
            </li>
          );
        }

        if (entry.type === 'route' && entry.showInNav) {
          return (
            <li key={entry.path}>
              <Link className="text-gray-800 hover:underline" to={entry.path}>
                {entry.label}
              </Link>
            </li>
          );
        }

        return null;
      })}
    </ul>
  );
}
