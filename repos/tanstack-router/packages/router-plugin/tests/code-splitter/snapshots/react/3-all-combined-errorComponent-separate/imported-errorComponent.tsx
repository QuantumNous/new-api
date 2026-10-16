const $$splitErrorComponentImporter = () => import('imported-errorComponent.tsx?tsr-split=errorComponent');
const $$splitComponentImporter = () => import('imported-errorComponent.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/')({
  component: lazyRouteComponent($$splitComponentImporter, 'component'),
  errorComponent: lazyRouteComponent($$splitErrorComponentImporter, 'errorComponent')
});