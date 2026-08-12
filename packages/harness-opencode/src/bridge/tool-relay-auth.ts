import { readdir, readFile, readlink } from 'node:fs/promises';
import type { Socket } from 'node:net';

export type ToolRelayCall = {
  toolName: string;
  input: unknown;
};

export class ToolRelayAuthorizer {
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly authorizations: Array<{ key: string; expiresAt: number }> =
    [];

  constructor({
    ttlMs = 10_000,
    now = Date.now,
  }: {
    ttlMs?: number;
    now?: () => number;
  } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  authorizeToolCall(call: ToolRelayCall): void {
    this.pruneExpired();
    this.authorizations.push({
      key: toolRelayCallKey(call),
      expiresAt: this.now() + this.ttlMs,
    });
  }

  consumeToolCall(call: ToolRelayCall): boolean {
    this.pruneExpired();
    const key = toolRelayCallKey(call);
    const index = this.authorizations.findIndex(auth => auth.key === key);
    if (index === -1) return false;
    this.authorizations.splice(index, 1);
    return true;
  }

  private pruneExpired(): void {
    const now = this.now();
    for (let i = this.authorizations.length - 1; i >= 0; i--) {
      if (this.authorizations[i].expiresAt <= now) {
        this.authorizations.splice(i, 1);
      }
    }
  }
}

function toolRelayCallKey({ toolName, input }: ToolRelayCall): string {
  return `${toolName}\0${canonicalJson(input ?? {})}`;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJsonValue(value));
}

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJsonValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeJsonValue(entryValue)]),
    );
  }
  return value;
}

export async function isToolRelayRequestFromAllowedProcess({
  socket,
  allowedScriptPaths,
}: {
  socket: Socket;
  allowedScriptPaths: ReadonlySet<string>;
}): Promise<boolean> {
  if (process.platform !== 'linux') return false;
  if (!socket.remotePort || !socket.localPort) return false;

  const inode = await findTcpSocketInode({
    clientPort: socket.remotePort,
    serverPort: socket.localPort,
  });
  if (!inode) return false;

  const cmdline = await findProcessCmdlineForSocketInode({ inode });
  return cmdline?.some(arg => allowedScriptPaths.has(arg)) ?? false;
}

async function findTcpSocketInode({
  clientPort,
  serverPort,
}: {
  clientPort: number;
  serverPort: number;
}): Promise<string | undefined> {
  for (const tablePath of ['/proc/net/tcp', '/proc/net/tcp6']) {
    const table = await readFile(tablePath, 'utf8').catch(() => undefined);
    if (!table) continue;
    for (const line of table.split('\n').slice(1)) {
      const columns = line.trim().split(/\s+/);
      if (columns.length < 10) continue;
      const local = parseProcNetAddress(columns[1]);
      const remote = parseProcNetAddress(columns[2]);
      if (
        local?.port === clientPort &&
        remote?.port === serverPort &&
        columns[9] !== '0'
      ) {
        return columns[9];
      }
    }
  }
  return undefined;
}

function parseProcNetAddress(value: string): { port: number } | undefined {
  const [, portHex] = value.split(':');
  if (!portHex) return undefined;
  return { port: Number.parseInt(portHex, 16) };
}

async function findProcessCmdlineForSocketInode({
  inode,
}: {
  inode: string;
}): Promise<string[] | undefined> {
  const procEntries = await readdir('/proc', { withFileTypes: true }).catch(
    () => [],
  );
  for (const entry of procEntries) {
    if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
    const fdDir = `/proc/${entry.name}/fd`;
    const fds = await readdir(fdDir).catch(() => []);
    for (const fd of fds) {
      const target = await readlink(`${fdDir}/${fd}`).catch(() => undefined);
      if (target !== `socket:[${inode}]`) continue;
      const cmdline = await readFile(`/proc/${entry.name}/cmdline`, 'utf8')
        .then(value => value.split('\0').filter(Boolean))
        .catch(() => undefined);
      if (cmdline) return cmdline;
    }
  }
  return undefined;
}
