import { createMiddleware } from '@tanstack/react-start';
export const withUseServer = createMiddleware({
  id: 'test'
});
export const withoutUseServer = createMiddleware({
  id: 'test'
});
export const withVariable = createMiddleware({
  id: 'test'
});
export const withZodValidator = createMiddleware({
  id: 'test'
});