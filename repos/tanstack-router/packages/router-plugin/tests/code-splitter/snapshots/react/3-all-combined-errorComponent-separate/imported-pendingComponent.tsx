const $$splitPendingComponentImporter = () => import('imported-pendingComponent.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
const $$splitComponentImporter = () => import('imported-pendingComponent.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/')({
  component: lazyRouteComponent($$splitComponentImporter, 'component'),
  pendingComponent: lazyRouteComponent($$splitPendingComponentImporter, 'pendingComponent')
});