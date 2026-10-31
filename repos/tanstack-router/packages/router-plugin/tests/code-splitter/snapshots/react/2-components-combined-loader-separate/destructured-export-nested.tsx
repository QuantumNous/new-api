const $$splitComponentImporter = () => import('destructured-export-nested.tsx?tsr-split=component---errorComponent---notFoundComponent---pendingComponent');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
const getConfig = () => ({
  api: {
    baseUrl: 'https://api.example.com'
  },
  timeout: 5000,
  extra: 'data'
});
export const {
  api: {
    baseUrl
  },
  ...rest
} = getConfig();
export const Route = createFileRoute('/about')({
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});