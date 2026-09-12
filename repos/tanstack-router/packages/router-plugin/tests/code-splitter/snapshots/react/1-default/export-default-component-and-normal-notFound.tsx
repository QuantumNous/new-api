console.warn("[tanstack-router] These exports from \"export-default-component-and-normal-notFound.tsx\" will not be code-split and will increase your bundle size:\n- Home\nFor the best optimization, these items should either have their export statements removed, or be imported from another location that is not a route file.");
const $$splitNotFoundComponentImporter = () => import('export-default-component-and-normal-notFound.tsx?tsr-split=notFoundComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/home')({
  component: Home,
  notFoundComponent: lazyRouteComponent($$splitNotFoundComponentImporter, 'notFoundComponent')
});
export default function Home() {
  const [one, setOne] = useState('this is from a state');
  return <div>
      <h1>{one}</h1>
    </div>;
}