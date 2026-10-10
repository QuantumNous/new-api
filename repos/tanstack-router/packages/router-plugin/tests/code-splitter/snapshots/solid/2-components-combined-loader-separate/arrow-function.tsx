const $$splitComponentImporter = () => import('arrow-function.tsx?tsr-split=component---errorComponent---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/solid-router';
const $$splitLoaderImporter = () => import('arrow-function.tsx?tsr-split=loader');
import { lazyFn } from '@tanstack/solid-router';
import { createFileRoute } from '@tanstack/solid-router';
export const Route = createFileRoute('/posts')({
  loader: lazyFn($$splitLoaderImporter, 'loader'),
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});