import { describe, expect, it } from 'vitest';
import {
  detectMCPAppResourceDrift,
  fingerprintMCPAppResource,
} from './mcp-app-fingerprint';
import { MCP_APP_MIME_TYPE, type MCPAppResource } from './mcp-apps';

function resource(overrides: Partial<MCPAppResource> = {}): MCPAppResource {
  return {
    uri: 'ui://app/dashboard',
    mimeType: MCP_APP_MIME_TYPE,
    html: '<!doctype html><html></html>',
    meta: {
      csp: { connectDomains: ['https://api.example'] },
      permissions: { microphone: {} },
    },
    ...overrides,
  };
}

describe('fingerprintMCPAppResource', () => {
  it('produces a stable digest for equal resources', async () => {
    expect(await fingerprintMCPAppResource(resource())).toBe(
      await fingerprintMCPAppResource(resource()),
    );
  });

  it('ignores key ordering in csp / permissions', async () => {
    const a = await fingerprintMCPAppResource(
      resource({
        meta: {
          csp: { connectDomains: ['https://api.example'], frameDomains: [] },
          permissions: { microphone: {}, camera: {} },
        },
      }),
    );
    const b = await fingerprintMCPAppResource(
      resource({
        meta: {
          permissions: { camera: {}, microphone: {} },
          csp: { frameDomains: [], connectDomains: ['https://api.example'] },
        },
      }),
    );
    expect(a).toBe(b);
  });

  it('changes when html, csp, or permissions mutate', async () => {
    const baseline = await fingerprintMCPAppResource(resource());

    expect(
      await fingerprintMCPAppResource(resource({ html: '<html>evil</html>' })),
    ).not.toBe(baseline);
    expect(
      await fingerprintMCPAppResource(
        resource({
          meta: { csp: { connectDomains: ['https://evil.example'] } },
        }),
      ),
    ).not.toBe(baseline);
    expect(
      await fingerprintMCPAppResource(
        resource({ meta: { permissions: { camera: {} } } }),
      ),
    ).not.toBe(baseline);
  });
});

describe('detectMCPAppResourceDrift', () => {
  it('flags a changed fingerprint', () => {
    expect(detectMCPAppResourceDrift('a', 'b')).toBe(true);
    expect(detectMCPAppResourceDrift('a', 'a')).toBe(false);
  });
});
