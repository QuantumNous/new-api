import * as React from 'react';
import { Outlet } from '@tanstack/react-router';
import { importedComponent as ImportedComponent } from '../../shared/imported';
function Layout() {
  return <main>
      <header style={{
      height: HEADER_HEIGHT
    }}>
        <nav>
          <ul>
            <li>
              <a href="/">Home</a>
            </li>
          </ul>
        </nav>
      </header>
      <ImportedComponent />
      <Outlet />
    </main>;
}
const HEADER_HEIGHT = '63px';
const ASIDE_WIDTH = '250px';
export { Layout as component };