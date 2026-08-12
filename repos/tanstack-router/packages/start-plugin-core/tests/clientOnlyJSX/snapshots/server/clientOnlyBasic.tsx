import { ClientOnly } from '@tanstack/react-router';
export function MyComponent() {
  return <div>
      <ClientOnly fallback={<div>Loading...</div>} />
    </div>;
}