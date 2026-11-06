const $$splitComponentImporter = () => import('shared-jsx-component-ref.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
const $$splitLoaderImporter = () => import('shared-jsx-component-ref.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyFn } from '@tanstack/react-router';
// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/jsx')({
  loader: lazyFn($$splitLoaderImporter, 'loader'),
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});