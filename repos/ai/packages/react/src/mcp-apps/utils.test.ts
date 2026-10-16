import { describe, expect, it } from 'vitest';
import type { MCPAppRendererProps } from './types';
import { getMCPAppFromToolPart } from './utils';

describe('getMCPAppFromToolPart', () => {
  it('extracts normalized app metadata from tool metadata', () => {
    const part = {
      type: 'dynamic-tool',
      toolName: 'showDashboard',
      toolCallId: 'call-1',
      state: 'input-available',
      input: { topic: 'usage' },
      toolMetadata: {
        clientName: 'local-mcp-apps',
        app: {
          resourceUri: 'ui://ai-sdk-e2e/dashboard',
          mimeType: 'text/html;profile=mcp-app',
          visibility: ['model', 'app'],
        },
      },
    } satisfies MCPAppRendererProps['part'];

    expect(getMCPAppFromToolPart(part)).toMatchInlineSnapshot(`
      {
        "mimeType": "text/html;profile=mcp-app",
        "resourceUri": "ui://ai-sdk-e2e/dashboard",
        "visibility": [
          "model",
          "app",
        ],
      }
    `);
  });

  it('ignores tool parts without valid app metadata', () => {
    const part = {
      type: 'dynamic-tool',
      toolName: 'plainTool',
      toolCallId: 'call-1',
      state: 'input-available',
      input: {},
      toolMetadata: {
        clientName: 'local-mcp-apps',
      },
    } satisfies MCPAppRendererProps['part'];

    expect(getMCPAppFromToolPart(part)).toBeUndefined();
  });
});
