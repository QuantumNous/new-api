const $$splitComponentImporter = () => import('destructured-export-multiple.tsx?tsr-split=component');
import { lazyRouteComponent } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
export const getConfig = () => ({
  baseUrl: 'https://api.example.com',
  timeout: 5000
});
export const {
  baseUrl,
  timeout
} = getConfig();
export const [first, second] = [1, 2];
export const Route = createFileRoute('/about')({
  component: lazyRouteComponent($$splitComponentImporter, 'component')
});