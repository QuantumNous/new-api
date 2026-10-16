const $$splitComponentImporter = () => import('arrow-function.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
const $$splitLoaderImporter = () => import('arrow-function.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyFn } from '@tanstack/react-router';
import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/posts')({
  loader: lazyFn($$splitLoaderImporter, 'loader'),
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});