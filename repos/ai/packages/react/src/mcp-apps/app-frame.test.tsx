import { MCP_APP_MIME_TYPE, type MCPAppResource } from '@ai-sdk/mcp';
import { cleanup, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MCPAppFrame } from './app-frame';
import type { MCPAppPermission } from './sandbox';

// The `allow` attribute is set in JSX and does not depend on the bridge
// handshake. Null the iframe's contentWindow so the bridge effect no-ops:
// jsdom cannot service the child-window postMessage the bridge teardown makes.
let originalContentWindow: PropertyDescriptor | undefined;
beforeAll(() => {
  originalContentWindow = Object.getOwnPropertyDescriptor(
    HTMLIFrameElement.prototype,
    'contentWindow',
  );
  Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
    configurable: true,
    get: () => null,
  });
});
afterAll(() => {
  if (originalContentWindow != null) {
    Object.defineProperty(
      HTMLIFrameElement.prototype,
      'contentWindow',
      originalContentWindow,
    );
  }
});
afterEach(cleanup);

const app = {
  resourceUri: 'ui://test/app',
  mimeType: MCP_APP_MIME_TYPE,
} as const;

function renderFrame({
  permissions,
  allowedPermissions,
}: {
  permissions?: Record<string, unknown>;
  allowedPermissions?: MCPAppPermission[];
}) {
  const resource: MCPAppResource = {
    uri: app.resourceUri,
    mimeType: MCP_APP_MIME_TYPE,
    html: '<!doctype html>',
    meta: permissions != null ? { permissions } : undefined,
  };

  const { container } = render(
    <MCPAppFrame
      app={app}
      resource={resource}
      sandbox={{ url: 'https://proxy.example/sandbox', allowedPermissions }}
    />,
  );

  return container.querySelector('iframe')!;
}

// The outer proxy iframe must carry the `allow` attribute itself: iframe
// Permissions Policy is delegated top-down, so a feature the outer frame does
// not delegate can never reach the inner app frame the proxy creates.
describe('MCPAppFrame permission delegation', () => {
  it('delegates the intersection of server-requested and host-allowed features', () => {
    const iframe = renderFrame({
      permissions: { geolocation: {}, camera: {} },
      allowedPermissions: ['geolocation'],
    });

    expect(iframe.getAttribute('allow')).toBe('geolocation');
  });

  it('emits no allow attribute without a host allowlist (deny-by-default)', () => {
    const iframe = renderFrame({
      permissions: { geolocation: {}, camera: {} },
    });

    expect(iframe.hasAttribute('allow')).toBe(false);
  });

  it('emits no allow attribute when nothing is both requested and allowed', () => {
    const iframe = renderFrame({
      permissions: { geolocation: {} },
      allowedPermissions: ['camera'],
    });

    expect(iframe.hasAttribute('allow')).toBe(false);
  });
});
