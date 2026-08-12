import { describe, expect, it } from 'vitest';
import * as mcp from '../index';

describe('validateJSONRPCMessage', () => {
  it('validates JSON-RPC requests', () => {
    expect(
      mcp.validateJSONRPCMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
      }),
    ).toEqual({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });
  });

  it('validates JSON-RPC responses', () => {
    expect(
      mcp.validateJSONRPCMessage({
        jsonrpc: '2.0',
        id: 1,
        result: { tools: [] },
      }),
    ).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [] },
    });
  });

  it('rejects invalid JSON-RPC messages', () => {
    expect(() =>
      mcp.validateJSONRPCMessage({
        jsonrpc: '1.0',
        id: 1,
        result: { tools: [] },
      }),
    ).toThrow();
  });

  it('does not export JSON-RPC schemas', () => {
    expect('JSONRPCMessageSchema' in mcp).toBe(false);
    expect('JSONRPCRequestSchema' in mcp).toBe(false);
    expect('JSONRPCResponseSchema' in mcp).toBe(false);
  });
});
