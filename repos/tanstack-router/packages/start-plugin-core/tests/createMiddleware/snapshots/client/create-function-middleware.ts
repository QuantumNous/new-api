import { createMiddleware } from '@tanstack/react-start';
export const fnMw = createMiddleware({
  type: 'function'
}).client(() => {
  console.log('client');
});