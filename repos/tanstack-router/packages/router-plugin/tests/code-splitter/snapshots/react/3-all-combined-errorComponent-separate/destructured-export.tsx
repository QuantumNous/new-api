const $$splitComponentImporter = () => import('destructured-export.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export function getObjectCallback() {
  return {
    getObject: () => ({
      constA: 10,
      constB: 5
    })
  };
}
export const {
  getObject
} = getObjectCallback();
export const Route = createFileRoute('/about')({
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});