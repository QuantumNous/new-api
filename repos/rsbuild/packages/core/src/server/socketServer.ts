import type { IncomingMessage } from 'node:http';
import type { Socket } from 'node:net';
import { parse as parseStack } from 'stacktrace-parser';
import type { WebSocket, WebSocketServer } from 'ws';
import { BROWSER_LOG_PREFIX, DEFAULT_STACK_TRACE } from '../constants.js';
import { color, isObject } from '../helpers';
import { formatStatsError } from '../helpers/format';
import { isRuntimeOverlayEnabled } from '../helpers/overlayConfig';
import { getStatsErrors, getStatsWarnings } from '../helpers/stats';
import type { ClientConfig, DevConfig, InternalContext, RsbuildStatsItem, Rspack } from '../types';
import { type CachedTraceMap, formatBrowserErrorLog } from './browserLogs';
import { renderErrorToHtml } from './overlay';

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
}

function isEqualSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) {
    return false;
  }

  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }

  return true;
}

const CHECK_SOCKETS_INTERVAL = 30000;

export type ServerMessageFullReload = {
  type: 'full-reload';
  data?: {
    /**
     * If `path` ends with `.html`, only the matching page will reload.
     * The HTML path should be relative to the dev server root and should not
     * include `server.base`. Use `'*'` to reload all pages.
     * @example `/foo.html`
     */
    path?: string;
  };
};

export type ServerMessageStaticChanged = {
  type: 'static-changed';
};

export type ServerMessageHash = {
  type: 'hash';
  data: string;
};

export type ServerMessageOk = {
  type: 'ok';
};

export type ServerMessageWarnings = {
  type: 'warnings';
  data: { text: string[] };
};

export type ServerMessageErrors = {
  type: 'errors';
  data: {
    text: string[];
    html: string;
  };
};

export type ServerMessageResolvedClientError = {
  type: 'resolved-client-error';
  data: {
    id: string;
    message: string;
  };
};

export type ServerCustomMessage = {
  type: 'custom';
  data: {
    event: string;
    data?: any;
  };
};

export type ServerMessage =
  | ServerMessageOk
  | ServerMessageFullReload
  | ServerMessageStaticChanged
  | ServerMessageHash
  | ServerMessageWarnings
  | ServerMessageErrors
  | ServerMessageResolvedClientError
  | ServerCustomMessage;

export type ClientMessageError = {
  type: 'client-error';
  id: string;
  message: string;
  name?: string;
  stack?: string;
};

export type ClientMessagePing = {
  type: 'ping';
};

export type ClientMessage = ClientMessagePing | ClientMessageError;

const parseQueryString = (req: IncomingMessage) => {
  const queryStr = req.url ? req.url.split('?')[1] : '';
  return queryStr ? Object.fromEntries(new URLSearchParams(queryStr)) : {};
};

const createRuntimeError = (payload: ClientMessageError): Error => {
  const error = new Error(payload.message);
  if (payload.name) {
    error.name = payload.name;
  }
  if (payload.stack) {
    error.stack = payload.stack;
  }
  return error;
};

const shouldShowRuntimeErrorOverlay = (
  overlay: ClientConfig['overlay'],
  payload: ClientMessageError,
): boolean => {
  if (!isRuntimeOverlayEnabled(overlay)) {
    return false;
  }

  if (typeof overlay === 'object' && typeof overlay.runtime === 'function') {
    return overlay.runtime(createRuntimeError(payload));
  }

  return true;
};

export class SocketServer {
  private wsServer!: WebSocketServer;

  private readonly socketsMap = new Map<string, Set<WebSocket>>();

  private readonly options: DevConfig;

  private readonly context: InternalContext;

  private initialChunksMap = new Map<string, Set<string>>();

  private heartbeatTimer: NodeJS.Timeout | null = null;

  private getOutputFileSystem: () => Rspack.OutputFileSystem;

  private reportedBrowserLogs = new Set<string>();

  private currentHash = new Map<string, string>();

  constructor(
    context: InternalContext,
    options: DevConfig,
    getOutputFileSystem: () => Rspack.OutputFileSystem,
  ) {
    this.context = context;
    this.options = options;
    this.getOutputFileSystem = getOutputFileSystem;
  }

  // subscribe upgrade event to handle socket
  public upgrade = (req: IncomingMessage, socket: Socket, head: Buffer): void => {
    if (!this.wsServer.shouldHandle(req)) {
      return;
    }

    const query = parseQueryString(req);
    const tokens = this.context.environmentList.map(({ webSocketToken }) => webSocketToken);

    // If the request does not contain a valid token, reject the request.
    if (!tokens.includes(query.token)) {
      socket.destroy();
      return;
    }

    this.wsServer.handleUpgrade(req, socket, head, (connection) => {
      this.wsServer.emit('connection', connection, req);
    });
  };

  // detect and close broken connections
  // https://github.com/websockets/ws/blob/8.18.0/README.md#how-to-detect-and-close-broken-connections
  private checkSockets = () => {
    for (const socket of this.wsServer.clients) {
      const extWs = socket as ExtWebSocket;
      if (!extWs.isAlive) {
        extWs.terminate();
      } else {
        extWs.isAlive = false;
        extWs.ping(() => {
          // empty
        });
      }
    }

    // Schedule next check only if timer hasn't been cleared
    if (this.heartbeatTimer !== null) {
      this.heartbeatTimer = setTimeout(this.checkSockets, CHECK_SOCKETS_INTERVAL).unref();
    }
  };

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // create socket, install socket handler, bind socket event
  public async prepare(): Promise<void> {
    this.clearHeartbeatTimer();

    const { WebSocketServer } = await import(/* rspackChunkName: "ws" */ 'ws');

    this.wsServer = new WebSocketServer({
      noServer: true,
      path: this.options.client?.path,
    });

    this.wsServer.on('error', (err: Error) => {
      this.context.logger.error(err);
    });

    this.heartbeatTimer = setTimeout(this.checkSockets, CHECK_SOCKETS_INTERVAL).unref();

    this.wsServer.on('connection', (socket, req) => {
      // /rsbuild-hmr?token=...
      const query = parseQueryString(req);

      this.onConnect(socket as ExtWebSocket, query.token);
    });
  }

  public onBuildDone(): void {
    this.reportedBrowserLogs.clear();
    this.ensureInitialChunks();

    if (!this.socketsMap.size) {
      return;
    }

    for (const token of this.socketsMap.keys()) {
      this.sendStats({ token });
    }
  }

  /**
   * Send error messages to the client.
   */
  public sendError(errors: Rspack.StatsError[], token: string): void {
    const { rootPath } = this.context;
    const formattedErrors = errors.map((item) =>
      formatStatsError(item, rootPath, 'error', this.context.logger),
    );

    const environment = this.getEnvironmentByToken(token);
    const overlay = environment?.config.dev.client.overlay;
    let overlayErrors = formattedErrors;

    if (overlay && typeof overlay === 'object' && typeof overlay.errors === 'function') {
      const { errors: filter } = overlay;
      overlayErrors = formattedErrors.filter((error) => filter(new Error(error)));
    }

    const html = overlayErrors
      .map((error) => renderErrorToHtml(error, rootPath))
      .join('\n\n')
      .trim();

    this.sendMessage(
      {
        type: 'errors',
        data: {
          text: formattedErrors,
          html,
        },
      },
      token,
    );
  }

  /**
   * Send warning messages to the client
   */
  public sendWarning(warnings: Rspack.StatsError[], token: string): void {
    const formattedWarnings = warnings.map((item) =>
      formatStatsError(item, this.context.rootPath, 'warning', this.context.logger),
    );
    this.sendMessage(
      {
        type: 'warnings',
        data: { text: formattedWarnings },
      },
      token,
    );
  }

  /**
   * Send a server message to matching client sockets.
   * @param message - The message to send
   * @param token - The token of the socket to send the message to,
   * if not provided, the message will be sent to all sockets
   */
  public sendMessage(message: ServerMessage, token?: string): void {
    const messageStr = JSON.stringify(message);

    const sendToSockets = (sockets: Set<WebSocket>) => {
      for (const socket of sockets) {
        this.sendRawMessage(socket, messageStr);
      }
    };

    if (token) {
      const sockets = this.socketsMap.get(token);
      if (sockets) {
        sendToSockets(sockets);
      }
    } else {
      for (const sockets of this.socketsMap.values()) {
        sendToSockets(sockets);
      }
    }
  }

  public async close(): Promise<void> {
    this.clearHeartbeatTimer();

    // Remove all event listeners
    this.wsServer.removeAllListeners();

    // Close all client sockets
    for (const socket of this.wsServer.clients) {
      socket.terminate();
    }
    // Close all tracked sockets
    for (const sockets of this.socketsMap.values()) {
      sockets.forEach((socket) => {
        socket.close();
      });
    }

    // Reset all properties
    this.socketsMap.clear();
    this.initialChunksMap.clear();
    this.reportedBrowserLogs.clear();

    return new Promise<void>((resolve, reject) => {
      this.wsServer.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private onConnect(socket: ExtWebSocket, token: string) {
    socket.isAlive = true;

    // heartbeat
    socket.on('pong', () => {
      socket.isAlive = true;
    });

    socket.on('message', async (data) => {
      try {
        const payload: ClientMessage = JSON.parse(
          // rslint-disable-next-line @typescript-eslint/no-base-to-string
          typeof data === 'string' ? data : data.toString(),
        );

        const { context } = this;
        const config = context.normalizedConfig;
        if (!config) {
          return;
        }

        const environment = this.getEnvironmentByToken(token);
        if (!environment) {
          return;
        }

        const { browserLogs, client } = environment.config.dev;
        if (
          payload.type === 'client-error' &&
          // Do not report browser error when build failed
          !context.buildState.hasErrors &&
          browserLogs
        ) {
          const stackTrace =
            (isObject(browserLogs) && browserLogs.stackTrace) || DEFAULT_STACK_TRACE;
          const outputFs = this.getOutputFileSystem();

          const stackFrames = payload.stack ? parseStack(payload.stack) : null;
          const cachedTraceMap: CachedTraceMap = new Map();

          const log = await formatBrowserErrorLog(
            payload.message,
            context,
            outputFs,
            stackTrace,
            stackFrames,
            cachedTraceMap,
          );

          if (!this.reportedBrowserLogs.has(log)) {
            this.reportedBrowserLogs.add(log);
            this.context.logger.error(`${color.cyan(BROWSER_LOG_PREFIX)} ${log}`);
          }

          // Render runtime errors in overlay
          if (shouldShowRuntimeErrorOverlay(client.overlay, payload)) {
            // Always display full stack trace for runtime errors
            const resolvedLog =
              // Reuse the formatted full log to avoid parsing the stack again.
              stackTrace === 'full'
                ? log
                : await formatBrowserErrorLog(
                    payload.message,
                    context,
                    outputFs,
                    'full',
                    stackFrames,
                    cachedTraceMap,
                  );

            this.sendMessage(
              {
                type: 'resolved-client-error',
                data: {
                  id: payload.id,
                  message: renderErrorToHtml(resolvedLog),
                },
              },
              token,
            );
          }
        }
      } catch {
        // ignore
      }
    });

    let sockets = this.socketsMap.get(token);
    if (!sockets) {
      sockets = new Set();
      this.socketsMap.set(token, sockets);
    }
    sockets.add(socket);

    socket.on('close', () => {
      const sockets = this.socketsMap.get(token);
      if (!sockets) {
        return;
      }

      sockets.delete(socket);
      if (sockets.size === 0) {
        this.socketsMap.delete(token);
      }
    });

    // send first stats to active client sock if stats exist
    this.sendStats({
      force: true,
      token,
    });
  }

  private getEnvironmentByToken(token: string) {
    return this.context.environmentList.find(({ webSocketToken }) => webSocketToken === token);
  }

  private getInitialChunks(stats: RsbuildStatsItem) {
    const initialChunks = new Set<string>();
    const { entrypoints } = stats;

    if (!entrypoints) {
      return initialChunks;
    }

    const entryNames = Object.keys(entrypoints);
    for (let entryIndex = 0; entryIndex < entryNames.length; entryIndex++) {
      const chunks = entrypoints[entryNames[entryIndex]]?.chunks;
      if (!Array.isArray(chunks)) {
        continue;
      }

      for (let index = 0; index < chunks.length; index++) {
        const chunkName = chunks[index];
        if (chunkName !== undefined) {
          initialChunks.add(typeof chunkName === 'string' ? chunkName : String(chunkName));
        }
      }
    }

    return initialChunks;
  }

  // Cache initial chunks for environments that have no baseline yet.
  // This keeps comparison stable even when no client socket is connected
  // during the first completed build.
  private ensureInitialChunks() {
    for (const { webSocketToken } of this.context.environmentList) {
      if (this.initialChunksMap.has(webSocketToken)) {
        continue;
      }

      const result = this.getStats(webSocketToken);
      if (result) {
        this.initialChunksMap.set(webSocketToken, this.getInitialChunks(result.stats));
      }
    }
  }

  // Only use stats when environment is matched
  private getStats(token: string) {
    const { stats } = this.context.buildState;
    const environment = this.getEnvironmentByToken(token);

    if (!stats || !environment) {
      return;
    }

    let currentStats: RsbuildStatsItem = stats;

    if (stats.children) {
      const childStats = stats.children[environment.index];
      if (childStats) {
        currentStats = childStats;
      }
    }

    // Collect errors and warnings from all stats
    // while using the matched stats for other data
    return {
      stats: currentStats,
      errors: getStatsErrors(stats),
      warnings: getStatsWarnings(stats),
    };
  }

  // determine what message should send by stats
  private sendStats({ force = false, token }: { token: string; force?: boolean }) {
    const result = this.getStats(token);
    if (!result) {
      return null;
    }

    const { stats, errors, warnings } = result;

    // web-infra-dev/rspack#6633
    // when initial-chunks change, reload the page
    // e.g: ['index.js'] -> ['index.js', 'lib-polyfill.js']
    const newInitialChunks = this.getInitialChunks(stats);

    const initialChunks = this.initialChunksMap.get(token);
    const shouldReload =
      stats.entrypoints && initialChunks && !isEqualSet(initialChunks, newInitialChunks);

    this.initialChunksMap.set(token, newInitialChunks);

    if (shouldReload) {
      this.sendMessage({ type: 'full-reload' }, token);
      return;
    }

    if (stats.hash) {
      const prevHash = this.currentHash.get(token);
      this.currentHash.set(token, stats.hash);

      // If build hash is not changed and there is no error or warning,
      // skip the other messages
      if (!force && errors.length === 0 && warnings.length === 0 && prevHash === stats.hash) {
        this.sendMessage({ type: 'ok' }, token);
        return;
      }

      this.sendMessage(
        {
          type: 'hash',
          data: stats.hash,
        },
        token,
      );
    }

    if (errors.length > 0) {
      this.sendError(errors, token);
      return;
    }

    if (warnings.length > 0) {
      this.sendWarning(warnings, token);
      return;
    }

    this.sendMessage({ type: 'ok' }, token);
  }

  // send a serialized message to a specific socket
  private sendRawMessage(socket: WebSocket, message: string) {
    if (socket.readyState !== socket.OPEN) {
      return;
    }

    socket.send(message);
  }
}
