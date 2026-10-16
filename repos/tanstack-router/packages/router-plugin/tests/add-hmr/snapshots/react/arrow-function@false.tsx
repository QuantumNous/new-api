const $$splitComponentImporter = () => import('arrow-function.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import * as React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { fetchPosts } from '../posts';
export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});