const $$splitLoaderImporter = () => import('using.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyFn } from '@tanstack/react-router';
export const Route = createFileRoute({
  loader: lazyFn($$splitLoaderImporter, 'loader')
});