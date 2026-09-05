console.warn("[tanstack-router] These exports from \"retain-export-component.tsx\" will not be code-split and will increase your bundle size:\n- Layout\nFor the best optimization, these items should either have their export statements removed, or be imported from another location that is not a route file.");
const $$splitLoaderImporter = () => import('retain-export-component.tsx?tsr-split=loader');
import { lazyFn } from '@tanstack/react-router';
import * as React from 'react';
import { createFileRoute, Outlet } from '@tanstack/react-router';
import { importedComponent as ImportedComponent } from '../../shared/imported';
export function Layout() {
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
export const Route = createFileRoute('/_layout')({
  component: Layout,
  loader: lazyFn($$splitLoaderImporter, 'loader')
});
const HEADER_HEIGHT = '63px';
export const SIDEBAR_WIDTH = '150px';
const SIDEBAR_MINI_WIDTH = '80px';
const ASIDE_WIDTH = '250px';