import { collection } from "shared-variable.tsx?tsr-shared=1";
const $$splitComponentImporter = () => import('shared-variable.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/todos')({
  loader: async () => {
    await collection.preload();
    return {
      data: 'loaded'
    };
  },
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});