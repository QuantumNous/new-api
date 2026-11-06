import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { JSONRPCMessage } from '../json-rpc-message';
import { MCPClientError } from '../../error/mcp-client-error';
import { createChildProcess } from './create-child-process';
import { deserializeMessage, StdioMCPTransport } from './mcp-stdio-transport';

vi.mock('./create-child-process', { spy: true });

interface MockChildProcess {
  stdin: EventEmitter & { write?: ReturnType<typeof vi.fn> };
  stdout: EventEmitter;
  stderr: EventEmitter;
  on: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
}

describe('StdioMCPTransport', () => {
  let transport: StdioMCPTransport;
  let mockChildProcess: MockChildProcess;
  let mockStdin: EventEmitter & { write?: ReturnType<typeof vi.fn> };
  let mockStdout: EventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStdin = new EventEmitter();
    mockStdout = new EventEmitter();
    mockChildProcess = {
      stdin: mockStdin,
      stdout: mockStdout,
      stderr: new EventEmitter(),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
    };

    vi.mocked(createChildProcess).mockReturnValue(
      mockChildProcess as unknown as ChildProcess,
    );

    transport = new StdioMCPTransport({
      command: 'test-command',
      args: ['--test'],
    });
  });

  afterEach(() => {
    transport.close();
  });

  describe('start', () => {
    it('should successfully start the transport', async () => {
      const stdinOnSpy = vi.spyOn(mockStdin, 'on');
      const stdoutOnSpy = vi.spyOn(mockStdout, 'on');

      mockChildProcess.on.mockImplementation(
        (event: string, callback: () => void) => {
          if (event === 'spawn') {
            callback();
          }
        },
      );

      const startPromise = transport.start();
      await expect(startPromise).resolves.toBeUndefined();

      expect(mockChildProcess.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(mockChildProcess.on).toHaveBeenCalledWith(
        'spawn',
        expect.any(Function),
      );
      expect(mockChildProcess.on).toHaveBeenCalledWith(
        'close',
        expect.any(Function),
      );

      expect(stdinOnSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(stdoutOnSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(stdoutOnSpy).toHaveBeenCalledWith('data', expect.any(Function));
    });

    it('should throw error if already started', async () => {
      mockChildProcess.on.mockImplementation(
        (event: string, callback: () => void) => {
          if (event === 'spawn') {
            callback();
          }
        },
      );
      const firstStart = transport.start();
      await expect(firstStart).resolves.toBeUndefined();
      const secondStart = transport.start();
      await expect(secondStart).rejects.toThrow(MCPClientError);
    });

    it('should handle spawn errors', async () => {
      const error = new Error('Spawn failed');
      const onErrorSpy = vi.fn();
      transport.onerror = onErrorSpy;

      // simulate `spawn` failure by emitting error event after returning child process
      mockChildProcess.on.mockImplementation(
        (event: string, callback: (err: Error) => void) => {
          if (event === 'error') {
            callback(error);
          }
        },
      );

      const startPromise = transport.start();
      await expect(startPromise).rejects.toThrow('Spawn failed');
      expect(onErrorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('send', () => {
    beforeEach(async () => {
      mockChildProcess.on.mockImplementation(
        (event: string, callback: () => void) => {
          if (event === 'spawn') {
            callback();
          }
        },
      );
      await transport.start();
    });

    it('should successfully send a message', async () => {
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: '1',
        method: 'test',
        params: {},
      };

      mockStdin.write = vi.fn().mockReturnValue(true);

      await transport.send(message);

      expect(mockStdin.write).toHaveBeenCalledWith(
        JSON.stringify(message) + '\n',
      );
    });

    it('should handle write backpressure', async () => {
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: '1',
        method: 'test',
        params: {},
      };

      mockStdin.write = vi.fn().mockReturnValue(false);

      const sendPromise = transport.send(message);

      mockStdin.emit('drain');

      await expect(sendPromise).resolves.toBeUndefined();
    });

    it('should throw error if transport is not connected', async () => {
      await transport.close();

      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: '1',
        method: 'test',
        params: {},
      };

      await expect(transport.send(message)).rejects.toThrow(MCPClientError);
    });
  });

  describe('message handling', () => {
    const onMessageSpy = vi.fn();

    beforeEach(async () => {
      mockChildProcess.on.mockImplementation(
        (event: string, callback: () => void) => {
          if (event === 'spawn') {
            callback();
          }
        },
      );
      transport.onmessage = onMessageSpy;
      await transport.start();
    });

    it('should handle incoming messages correctly', async () => {
      const message: JSONRPCMessage = {
        jsonrpc: '2.0',
        id: '1',
        method: 'test',
        params: {},
      };

      mockStdout.emit('data', Buffer.from(JSON.stringify(message) + '\n'));
      await vi.waitFor(() => {
        expect(onMessageSpy).toHaveBeenCalledWith(message);
      });
    });

    it('should handle partial messages correctly', async () => {
      const message = {
        jsonrpc: '2.0',
        id: '1',
        method: 'test',
        params: {},
      };

      const messageStr = JSON.stringify(message);
      mockStdout.emit('data', Buffer.from(messageStr.slice(0, 10)));
      mockStdout.emit('data', Buffer.from(messageStr.slice(10) + '\n'));
      await vi.waitFor(() => {
        expect(onMessageSpy).toHaveBeenCalledWith(message);
      });
    });
  });

  describe('deserializeMessage', () => {
    it('should reject payloads containing __proto__ (prototype pollution)', async () => {
      const malicious =
        '{"jsonrpc":"2.0","id":1,"result":{"__proto__":{"polluted":true}}}';

      await expect(
        deserializeMessage(malicious),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `
        [AI_JSONParseError: JSON parsing failed: Text: {"jsonrpc":"2.0","id":1,"result":{"__proto__":{"polluted":true}}}.
        Error message: SyntaxError: Object contains forbidden prototype property]
      `,
      );
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('should reject payloads containing constructor.prototype', async () => {
      const malicious =
        '{"jsonrpc":"2.0","id":1,"result":{"constructor":{"prototype":{"polluted":true}}}}';

      await expect(
        deserializeMessage(malicious),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `
        [AI_JSONParseError: JSON parsing failed: Text: {"jsonrpc":"2.0","id":1,"result":{"constructor":{"prototype":{"polluted":true}}}}.
        Error message: SyntaxError: Object contains forbidden prototype property]
      `,
      );
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  describe('close', () => {
    const onCloseSpy = vi.fn();

    beforeEach(async () => {
      mockChildProcess.on.mockImplementation(
        (event: string, callback: (code?: number) => void) => {
          if (event === 'spawn') {
            callback();
          } else if (event === 'close') {
            callback(0);
          }
        },
      );
      transport.onclose = onCloseSpy;
      await transport.start();
    });

    it('should close the transport successfully', async () => {
      await transport.close();

      expect(mockChildProcess.on).toHaveBeenCalledWith(
        'close',
        expect.any(Function),
      );
      expect(onCloseSpy).toHaveBeenCalled();
    });
  });
});
