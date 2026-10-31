import { createRootRoute } from '@tanstack/react-router';
export const Route = createRootRoute({
  component: () => {
    return <div className="p-2">hello world</div>;
  }
});