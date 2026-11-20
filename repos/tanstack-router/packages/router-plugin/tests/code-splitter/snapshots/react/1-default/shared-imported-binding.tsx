const $$splitComponentImporter = () => import('shared-imported-binding.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { sharedUtil } from '../utils';
export const Route = createFileRoute('/imported')({
  loader: async () => sharedUtil('load'),
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});