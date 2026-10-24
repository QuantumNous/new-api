import { createStart } from '@tanstack/react-start';
export const startInstance = createStart(() => {});
export const serverFnMw = startInstance.createMiddleware({
  type: 'function'
}).client(({
  next
}) => {
  console.log('client mw');
  return next();
});
export const requestMw = startInstance.createMiddleware({
  type: 'request'
});