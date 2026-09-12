import { state, getCount } from "shared-indirect-ref.tsx?tsr-shared=1";
const $$splitComponentImporter = () => import('shared-indirect-ref.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/shared-indirect')({
  loader: () => {
    state.count++;
    return {
      count: getCount()
    };
  },
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});