const $$splitComponentImporter = () => import('shared-class.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
const $$splitLoaderImporter = () => import('shared-class.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyFn } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
class DataStore {
  data = new Map();
  get(k: string) {
    return this.data.get(k);
  }
  set(k: string, v: unknown) {
    this.data.set(k, v);
  }
}
export const Route = createFileRoute('/store')({
  loader: lazyFn($$splitLoaderImporter, 'loader'),
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});