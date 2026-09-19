// Test: ClientOnly imported with an alias should still be transformed
import { ClientOnly as CO } from '@tanstack/react-router';
export function MyComponent() {
  return <div>
      <CO fallback={<div>Loading...</div>} />
    </div>;
}