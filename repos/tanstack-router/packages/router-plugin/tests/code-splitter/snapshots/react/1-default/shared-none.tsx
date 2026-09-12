const $$splitComponentImporter = () => import('shared-none.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
const loaderHelper = () => fetch('/api');
export const Route = createFileRoute('/clean')({
  loader: async () => loaderHelper(),
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});