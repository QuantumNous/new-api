import { shared } from "shared-jsx-component-ref.tsx?tsr-shared=1";
const $$splitComponentImporter = () => import('shared-jsx-component-ref.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/jsx')({
  loader: () => shared,
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});