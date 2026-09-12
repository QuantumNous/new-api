declare global {
  interface Window {
    __RSBUILD_WEBSOCKET_URL__: string;
  }
}

export default function resolveWebSocketUrl(url: string): string {
  const resolved = new URL(url);
  resolved.host = location.host;
  window.__RSBUILD_WEBSOCKET_URL__ = resolved.toString();
  return resolved.toString();
}
