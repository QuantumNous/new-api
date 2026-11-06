const $$splitNotFoundComponentImporter = () => import('imported-notFoundComponent.tsx?tsr-split=notFoundComponent');
const $$splitComponentImporter = () => import('imported-notFoundComponent.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/')({
  component: lazyRouteComponent($$splitComponentImporter, 'component'),
  notFoundComponent: lazyRouteComponent($$splitNotFoundComponentImporter, 'notFoundComponent')
});