const $$splitComponentImporter = () => import('shared-destructured-export.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
const $$splitLoaderImporter = () => import('shared-destructured-export.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyFn } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export const {
  apiUrl,
  timeout
} = getConfig();
export const Route = createFileRoute('/config')({
  loader: lazyFn($$splitLoaderImporter, 'loader'),
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});
function getConfig() {
  return {
    apiUrl: '/api',
    timeout: 5000
  };
}