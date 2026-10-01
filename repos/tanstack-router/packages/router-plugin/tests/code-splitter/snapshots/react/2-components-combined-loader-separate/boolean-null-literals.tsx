const $$splitLoaderImporter = () => import('boolean-null-literals.tsx?tsr-split=loader');
import { lazyFn } from '@tanstack/react-router';
const $$splitComponentImporter = () => import('boolean-null-literals.tsx?tsr-split=component---errorComponent---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/router';

// Test errorComponent with false literal
export const Route = createFileRoute('/test')({
  component: lazyRouteComponent($$splitComponentImporter, 'component'),
  errorComponent: false,
  pendingComponent: null,
  loader: lazyFn($$splitLoaderImporter, 'loader')
});