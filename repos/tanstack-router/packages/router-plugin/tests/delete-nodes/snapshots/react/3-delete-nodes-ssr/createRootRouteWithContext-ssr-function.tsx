import { createRootRouteWithContext } from '@tanstack/react-router';
export const Route = createRootRouteWithContext<{}>()({
  component: () => {
    return <div className="p-2">hello world</div>;
  }
});