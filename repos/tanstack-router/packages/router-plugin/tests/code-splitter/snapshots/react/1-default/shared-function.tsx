import { getCached, cache } from "shared-function.tsx?tsr-shared=1";
const $$splitComponentImporter = () => import('shared-function.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
function setCached(key: string, val: unknown) {
  cache.set(key, val);
}
export const Route = createFileRoute('/cached')({
  loader: async () => {
    setCached('data', await fetch('/api').then(r => r.json()));
    return getCached('data');
  },
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});