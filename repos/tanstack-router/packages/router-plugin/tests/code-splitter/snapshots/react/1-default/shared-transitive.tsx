import { config } from "shared-transitive.tsx?tsr-shared=1";
const $$splitComponentImporter = () => import('shared-transitive.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
const fetcher = (path: string) => fetch(`${config.url}${path}`);
export const Route = createFileRoute('/api')({
  loader: async () => {
    return fetcher('/data');
  },
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});