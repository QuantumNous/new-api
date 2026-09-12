const $$splitComponentImporter = () => import('conditional-properties.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { isEnabled } from '@features/feature-flags';
import TrueImport from '@modules/true-component';
import { falseLoader } from '@modules/false-component';
export const Route = createFileRoute('/posts')({
  component: lazyRouteComponent($$splitComponentImporter, 'component'),
  loader: isEnabled ? TrueImport.loader : falseLoader
});