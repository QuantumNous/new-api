import type { ChildProcess, IOType } from 'node:child_process';
import type { Stream } from 'node:stream';
import { parseJSONRPCMessage, type JSONRPCMessage } from '../json-rpc-message';
import type { MCPTransport } from '../mcp-transport';
import { MCPClientError } from '../../error/mcp-client-error';
import { createChildProcess } from './create-child-process';

export interface StdioConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  stderr?: IOType | Stream | number;
  cwd?: string;
}

export class StdioMCPTransport implements MCPTransport {
  private process?: ChildProcess;
  private abortController: AbortController = new AbortController();
  private readBuffer: ReadBuffer = new ReadBuffer();
  private serverParams: StdioConfig;

  onclose?: () => void;
  onerror?: (error: unknown) => void;
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(server: StdioConfig) {
    this.serverParams = server;
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new MCPClientError({
        message: 'StdioMCPTransport already started.',
      });
    }

    return new Promise((resolve, reject) => {
      try {
        const process = createChildProcess(
          this.serverParams,
          this.abortController.signal,
        );

        this.process = process;

        this.process.on('error', error => {
          if (error.name === 'AbortError') {
            this.onclose?.();
            return;
          }

          reject(error);
          this.onerror?.(error);
        });

        this.process.on('spawn', () => {
          resolve();
        });

        this.process.on('close', _code => {
          this.process = undefined;
          this.onclose?.();
        });

        this.process.stdin?.on('error', error => {
          this.onerror?.(error);
        });

        this.process.stdout?.on('data', chunk => {
          this.readBuffer.append(chunk);
          void this.processReadBuffer();
        });

        this.process.stdout?.on('error', error => {
          this.onerror?.(error);
        });
      } catch (error) {
        reject(error);
        this.onerror?.(error);
      }
    });
  }

  private async processReadBuffer() {
    while (true) {
      const line = this.readBuffer.readLine();
      if (line === null) {
        break;
      }

      try {
        const message = await deserializeMessage(line);
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(error as Error);
      }
    }
  }

  async close(): Promise<void> {
    this.abortController.abort();
    this.process = undefined;
    this.readBuffer.clear();
  }

  send(message: JSONRPCMessage): Promise<void> {
    return new Promise(resolve => {
      if (!this.process?.stdin) {
        throw new MCPClientError({
          message: 'StdioClientTransport not connected',
        });
      }

      const json = serializeMessage(message);
      if (this.process.stdin.write(json)) {
        resolve();
      } else {
        this.process.stdin.once('drain', resolve);
      }
    });
  }
}

class ReadBuffer {
  private buffer?: Buffer;

  append(chunk: Buffer): void {
    this.buffer = this.buffer ? Buffer.concat([this.buffer, chunk]) : chunk;
  }

  readLine(): string | null {
    if (!this.buffer) return null;

    const index = this.buffer.indexOf('\n');
    if (index === -1) {
      return null;
    }

    const line = this.buffer.toString('utf8', 0, index);
    this.buffer = this.buffer.subarray(index + 1);
    return line;
  }

  clear(): void {
    this.buffer = undefined;
  }
}

function serializeMessage(message: JSONRPCMessage): string {
  return JSON.stringify(message) + '\n';
}

export async function deserializeMessage(
  line: string,
): Promise<JSONRPCMessage> {
  return parseJSONRPCMessage(line);
}
