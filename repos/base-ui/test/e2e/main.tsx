import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router';
import * as DomTestingLibrary from '@testing-library/dom';
import TestViewer from './TestViewer';
import 'docs/src/css/index.css';

interface Fixture {
  Component: React.ComponentType<any>;
  name: string;
  path: string;
  suite: string;
}

const globbedFixtures = import.meta.glob<{ default: React.ComponentType<unknown> }>(
  './fixtures/**/*.{js,jsx,ts,tsx}',
  {
    eager: true,
  },
);

const fixtures: Fixture[] = [];

for (const path in globbedFixtures) {
  const [suite, name] = path
    .replace('./', '')
    .replace(/\.\w+$/, '')
    .split('/');

  fixtures.push({
    path,
    suite: `e2e-${suite}`,
    name,
    Component: globbedFixtures[path].default,
  });
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
    return `/${fixture.suite}/${fixture.path.slice(11, -4)}`;
  }

  return (
    <Router>
      <Routes>
        {fixtures.map((fixture) => {
          const path = computePath(fixture);
          const FixtureComponent = fixture.Component;
          if (FixtureComponent === undefined) {
            console.warn('Missing `Component` ', fixture);
            return null;
          }

          return (
            <Route
              key={path}
              path={path}
              element={
                <TestViewer>
                  <FixtureComponent />
                </TestViewer>
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
              {fixtures.map((test) => {
                const path = computePath(test);
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

window.DomTestingLibrary = DomTestingLibrary;
window.elementToString = function elementToString(element) {
  if (
    element != null &&
    (element.nodeType === element.ELEMENT_NODE || element.nodeType === element.DOCUMENT_NODE)
  ) {
    return window.DomTestingLibrary.prettyDOM(element as Element, undefined, {
      highlight: true,
      maxDepth: 1,
    });
  }
  return String(element);
};
