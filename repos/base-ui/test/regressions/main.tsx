import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router';
import TestViewer from './TestViewer';
import { fixtures, type Fixture } from './fixtures';
import 'docs/src/css/index.css';

const viewerRoot = document.getElementById('test-viewer');

function FixtureRenderer({
  component: FixtureComponent,
  isTailwind,
}: {
  component: React.ElementType;
  isTailwind: boolean;
}) {
  const viewerReactRoot = React.useRef<ReactDOMClient.Root | null>(null);

  React.useLayoutEffect(() => {
    const renderTimeout = setTimeout(() => {
      const children = (
        <TestViewer isTailwind={isTailwind}>
          <FixtureComponent />
        </TestViewer>
      );

      if (viewerReactRoot.current == null && viewerRoot != null) {
        viewerReactRoot.current = ReactDOMClient.createRoot(viewerRoot);
      }

      viewerReactRoot.current?.render(children);
    });

    return () => {
      clearTimeout(renderTimeout);
      setTimeout(() => {
        viewerReactRoot.current?.unmount();
        viewerReactRoot.current = null;
      });
    };
  }, [FixtureComponent, isTailwind]);

  return null;
}

function App() {
  function computeIsDev() {
    if (window.location.hash === '#dev') {
      return true;
    }
    if (window.location.hash === '#no-dev') {
      return false;
    }
    return process.env.NODE_ENV === 'development';
  }
  const [isDev, setDev] = React.useState(computeIsDev);
  React.useEffect(() => {
    function handleHashChange() {
      setDev(computeIsDev());
    }
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  function computePath(fixture: Fixture) {
    return `/${fixture.suite}/${fixture.name}`;
  }

  return (
    <Router>
      <Routes>
        {fixtures.map((fixture) => {
          const path = computePath(fixture);
          const FixtureComponent = fixture.Component;
          if (FixtureComponent === undefined) {
            console.warn('Missing `Component` for ', fixture);
            return null;
          }

          return (
            <Route
              key={path}
              path={path}
              element={
                <FixtureRenderer component={FixtureComponent} isTailwind={fixture.isTailwind} />
              }
            />
          );
        })}
      </Routes>

      <div hidden={!isDev}>
        <p>
          Devtools can be enabled by appending <code>#dev</code> in the addressbar or disabled by
          appending <code>#no-dev</code>.
        </p>
        <a href="#no-dev">Hide devtools</a>
        <details>
          <summary id="my-test-summary">nav for all tests</summary>
          <nav id="tests">
            <ol>
              {fixtures.map((fixture) => {
                const path = computePath(fixture);
                return (
                  <li key={path}>
                    <Link to={path}>{path}</Link>
                  </li>
                );
              })}
            </ol>
          </nav>
        </details>
      </div>
    </Router>
  );
}

const container = document.getElementById('react-root');
const children = <App />;

if (container != null) {
  const reactRoot = ReactDOMClient.createRoot(container);
  reactRoot.render(children);
}
