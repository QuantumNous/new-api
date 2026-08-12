import { convertUint8ArrayToBase64 } from '@ai-sdk/provider-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { createMCPClient, type MCPClient } from './mcp-client';
import {
  MCP_APP_MIME_TYPE,
  getMCPAppResourceFromReadResult,
  getMCPAppResourceUri,
  getMCPAppResourceUris,
  getMCPAppToolMeta,
  mcpAppClientCapabilities,
  readMCPAppResource,
  splitMCPAppTools,
} from './mcp-apps';
import { MockMCPTransport } from './mock-mcp-transport';
import type { ListToolsResult, MCPTool } from './types';

const uiTool = {
  name: 'showDashboard',
  description: 'Show dashboard',
  inputSchema: { type: 'object' },
  _meta: {
    ui: {
      resourceUri: 'ui://ai-sdk-e2e/dashboard',
      visibility: ['model', 'app'],
    },
  },
} satisfies MCPTool;

const appOnlyTool = {
  name: 'refreshDashboardData',
  description: 'Refresh dashboard data',
  inputSchema: { type: 'object' },
  _meta: {
    ui: {
      resourceUri: 'ui://ai-sdk-e2e/dashboard',
      visibility: ['app'],
    },
  },
} satisfies MCPTool;

const plainTool = {
  name: 'plainTool',
  description: 'Plain tool',
  inputSchema: { type: 'object' },
} satisfies MCPTool;

describe('MCP Apps helpers', () => {
  let client: MCPClient | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });

  it('exports MCP Apps client capabilities', () => {
    expect(mcpAppClientCapabilities).toMatchInlineSnapshot(`
      {
        "extensions": {
          "io.modelcontextprotocol/ui": {
            "mimeTypes": [
              "text/html;profile=mcp-app",
            ],
          },
        },
      }
    `);
  });

  it('reads normalized tool metadata', () => {
    expect(getMCPAppToolMeta(uiTool)).toMatchInlineSnapshot(`
      {
        "resourceUri": "ui://ai-sdk-e2e/dashboard",
        "visibility": [
          "model",
          "app",
        ],
      }
    `);
    expect(getMCPAppResourceUri(uiTool)).toBe('ui://ai-sdk-e2e/dashboard');
  });

  it('supports the legacy flat resource URI metadata key', () => {
    expect(
      getMCPAppResourceUri({
        _meta: { 'ui/resourceUri': 'ui://legacy/app' },
      }),
    ).toMatchInlineSnapshot(`"ui://legacy/app"`);
  });

  it('rejects invalid app resource URIs', () => {
    expect(() =>
      getMCPAppResourceUri({
        _meta: { ui: { resourceUri: 'https://example.com/app.html' } },
      }),
    ).toThrow('Invalid MCP App resource URI');
  });

  it('splits model-visible and app-visible tools', () => {
    const definitions = {
      tools: [plainTool, uiTool, appOnlyTool],
      nextCursor: 'next',
    } satisfies ListToolsResult;

    const split = splitMCPAppTools(definitions);

    expect({
      modelVisible: split.modelVisible.tools.map(tool => tool.name),
      appVisible: split.appVisible.tools.map(tool => tool.name),
      nextCursor: split.modelVisible.nextCursor,
    }).toMatchInlineSnapshot(`
      {
        "appVisible": [
          "showDashboard",
          "refreshDashboardData",
        ],
        "modelVisible": [
          "plainTool",
          "showDashboard",
        ],
        "nextCursor": "next",
      }
    `);
  });

  it('deduplicates app resource URIs', () => {
    expect(getMCPAppResourceUris({ tools: [plainTool, uiTool, appOnlyTool] }))
      .toMatchInlineSnapshot(`
      [
        "ui://ai-sdk-e2e/dashboard",
      ]
    `);
  });

  it('reads text MCP App resources', async () => {
    client = await createMCPClient({
      transport: new MockMCPTransport({
        resourceContents: [
          {
            uri: 'ui://ai-sdk-e2e/dashboard',
            mimeType: MCP_APP_MIME_TYPE,
            text: '<!doctype html><html></html>',
            _meta: { ui: { prefersBorder: true } },
          },
        ],
      }),
      capabilities: mcpAppClientCapabilities,
    });

    expect(
      await readMCPAppResource({
        client,
        uri: 'ui://ai-sdk-e2e/dashboard',
      }),
    ).toMatchInlineSnapshot(`
      {
        "html": "<!doctype html><html></html>",
        "meta": {
          "prefersBorder": true,
        },
        "mimeType": "text/html;profile=mcp-app",
        "uri": "ui://ai-sdk-e2e/dashboard",
      }
    `);
  });

  it('reads blob MCP App resources', () => {
    const html = '<!doctype html><html>blob</html>';

    expect(
      getMCPAppResourceFromReadResult({
        uri: 'ui://ai-sdk-e2e/dashboard',
        resource: {
          contents: [
            {
              uri: 'ui://ai-sdk-e2e/dashboard',
              mimeType: MCP_APP_MIME_TYPE,
              blob: convertUint8ArrayToBase64(new TextEncoder().encode(html)),
            },
          ],
        },
      }),
    ).toMatchInlineSnapshot(`
      {
        "html": "<!doctype html><html>blob</html>",
        "meta": undefined,
        "mimeType": "text/html;profile=mcp-app",
        "uri": "ui://ai-sdk-e2e/dashboard",
      }
    `);
  });

  it('calls app-visible tools through the MCP client', async () => {
    client = await createMCPClient({
      transport: new MockMCPTransport({
        overrideTools: [appOnlyTool],
        toolCallResults: {
          refreshDashboardData: {
            content: [{ type: 'text', text: 'Refreshed' }],
            structuredContent: { ok: true },
          },
        },
      }),
    });

    expect(
      await client.callTool({
        name: 'refreshDashboardData',
        arguments: { reason: 'test' },
      }),
    ).toMatchInlineSnapshot(`
      {
        "content": [
          {
            "text": "Refreshed",
            "type": "text",
          },
        ],
        "isError": false,
        "structuredContent": {
          "ok": true,
        },
      }
    `);
  });
});
