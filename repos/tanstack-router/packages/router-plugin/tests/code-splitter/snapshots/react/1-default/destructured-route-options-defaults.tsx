import { loader } from "destructured-route-options-defaults.tsx?tsr-shared=1";
const $$splitComponentImporter = () => import('destructured-route-options-defaults.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/about')({
  component: lazyRouteComponent($$splitComponentImporter, 'component'),
  loader
});