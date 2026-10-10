import { safeParseJSON } from '@ai-sdk/provider-utils';
import type {
  RealtimeClientEvent,
  RealtimeModel,
  RealtimeServerEvent,
} from '../types/realtime-model';

export type BrowserRealtimeTransportOptions = {
  model: RealtimeModel;
  onServerEvent: (event: RealtimeServerEvent) => void | Promise<void>;
  onError: (error: Error) => void;
  onClose: () => void;
};

export class BrowserRealtimeTransport {
  private readonly model: RealtimeModel;
  private readonly onServerEvent: BrowserRealtimeTransportOptions['onServerEvent'];
  private readonly onError: BrowserRealtimeTransportOptions['onError'];
  private readonly onClose: BrowserRealtimeTransportOptions['onClose'];
  private ws: WebSocket | null = null;
  private sendQueue: Promise<void> = Promise.resolve();

  constructor(options: BrowserRealtimeTransportOptions) {
    this.model = options.model;
    this.onServerEvent = options.onServerEvent;
    this.onError = options.onError;
    this.onClose = options.onClose;
  }

  connect({
    token,
    url,
    onOpen,
  }: {
    token: string;
    url: string;
    onOpen: () => void;
  }): void {
    this.ws?.close();
    this.ws = null;

    const wsConfig = this.model.getWebSocketConfig({ token, url });
    const ws = new WebSocket(wsConfig.url, wsConfig.protocols);

    // Track the socket immediately (not just in `onopen`) so that calling
    // `disconnect()` while it is still connecting actually closes it. Otherwise
    // `close()` would be a no-op and the socket could open afterwards and fire
    // the `onOpen` (session-update) callback against a disconnected session.
    this.ws = ws;

    ws.onopen = () => {
      // Ignore a late open for a socket that has since been replaced/closed.
      if (this.ws !== ws) return;
      onOpen();
    };

    ws.onmessage = messageEvent => {
      void this.handleMessage(messageEvent);
    };

    ws.onerror = () => {
      this.onError(new Error('WebSocket connection error'));
    };

    ws.onclose = () => {
      if (this.ws === ws) {
        this.ws = null;
        this.onClose();
      }
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  sendEvent(event: RealtimeClientEvent): void {
    this.sendQueue = this.sendQueue
      .then(async () => {
        const serialized = await this.model.serializeClientEvent(event);
        if (serialized != null) {
          this.sendRaw(serialized);
        }
      })
      .catch(error => {
        this.onError(
          error instanceof Error
            ? error
            : new Error(`Failed to send realtime event: ${String(error)}`),
        );
      });
  }

  sendRaw(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (
        typeof data === 'string' ||
        data instanceof ArrayBuffer ||
        ArrayBuffer.isView(data) ||
        data instanceof Blob
      ) {
        this.ws.send(data);
      } else {
        this.ws.send(JSON.stringify(data));
      }
    }
  }

  dispose(): void {
    this.disconnect();
  }

  private async handleMessage(messageEvent: MessageEvent): Promise<void> {
    let text: string;
    if (typeof messageEvent.data === 'string') {
      text = messageEvent.data;
    } else if (messageEvent.data instanceof Blob) {
      text = await messageEvent.data.text();
    } else {
      text = new TextDecoder().decode(messageEvent.data);
    }

    const parseResult = await safeParseJSON({ text });
    if (!parseResult.success) return;

    const rawEvent = parseResult.value;

    if (this.model.getHealthCheckResponse != null) {
      const autoResponse = this.model.getHealthCheckResponse(rawEvent);
      if (autoResponse != null) {
        this.sendRaw(autoResponse);
      }
    }

    const result = this.model.parseServerEvent(rawEvent);
    const events = Array.isArray(result) ? result : [result];

    for (const event of events) {
      await this.onServerEvent(event);
    }
  }
}
