'use client';

const $$splitComponentImporter = () => import('directive-prologue.tsx?tsr-split=component---loader---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/directive')({
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});