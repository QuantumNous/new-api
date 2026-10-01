import { createFileRoute } from '@tanstack/solid-router';
export const Route = createFileRoute('/')({
  component: () => {
    return <div className="p-2">hello world</div>;
  }
});