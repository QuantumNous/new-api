import { queryOptions } from "shared-exported.tsx?tsr-shared=1";
const $$splitComponentImporter = () => import('shared-exported.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/query')({
  loader: async () => {
    return {
      staleTime: queryOptions.staleTime
    };
  },
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});
export { queryOptions } from "shared-exported.tsx?tsr-shared=1";