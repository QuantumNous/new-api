const $$splitLoaderImporter = () => import('destructured-route-options-defaults.tsx?tsr-split=loader');
import { lazyFn } from '@tanstack/react-router';
const $$splitComponentImporter = () => import('destructured-route-options-defaults.tsx?tsr-split=component---errorComponent---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/about')({
  component: lazyRouteComponent($$splitComponentImporter, 'component'),
  loader: lazyFn($$splitLoaderImporter, 'loader')
});