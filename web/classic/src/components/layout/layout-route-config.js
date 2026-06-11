export const CONSOLE_TOPBAR_ONLY_ROUTES = new Set([
  '/console/playground',
  '/console/image-playground',
  '/console/video-playground',
]);

export const isConsoleTopbarOnlyRoute = (pathname) =>
  CONSOLE_TOPBAR_ONLY_ROUTES.has(pathname);
