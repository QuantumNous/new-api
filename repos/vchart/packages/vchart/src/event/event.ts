/*eslint no-dupe-class-members: "off"*/

import { Factory } from '../core/factory';
import type { RenderMode } from '../typings/spec/common';
import type {
  EventType,
  EventQuery,
  EventCallback,
  EventParamsDefinition,
  IEvent,
  IEventDispatcher,
  IComposedEvent,
  EventParams,
  EventHandler,
  EventBubbleLevel
} from './interface';

export class Event implements IEvent {
  private _eventDispatcher: IEventDispatcher;
  private _mode: RenderMode;

  private _composedEventMap: Map<EventCallback<EventParams>, { eventType: EventType; event: IComposedEvent }> =
    new Map();
  private _eventHandlerMap: Map<EventType, Map<EventCallback<EventParams>, EventHandler<EventParams>>> = new Map();
  getComposedEventMap() {
    return this._composedEventMap;
  }

  constructor(eventDispatcher: IEventDispatcher, mode: RenderMode) {
    this._eventDispatcher = eventDispatcher;
    this._mode = mode;
  }

  on<Evt extends EventType>(eType: Evt, callback: EventCallback<EventParamsDefinition[Evt]>): this;
  on<Evt extends EventType>(eType: Evt, query: EventQuery, callback: EventCallback<EventParamsDefinition[Evt]>): this;
  on<Evt extends EventType>(
    eType: Evt,
    query: EventQuery | EventCallback<EventParamsDefinition[Evt]>,
    callback?: EventCallback<EventParamsDefinition[Evt]>
  ): this {
    const handler: EventHandler<EventParamsDefinition[Evt]> =
      typeof query === 'function'
        ? { query: null, callback: query }
        : {
            query,
            callback: callback as EventCallback<EventParamsDefinition[Evt]>
          };

    const ComposedEventCtor = Factory.getComposedEvent(eType);
    if (ComposedEventCtor) {
      const composedEvent = new ComposedEventCtor(this._eventDispatcher, this._mode) as IComposedEvent;
      composedEvent.register(eType, handler);
      this._composedEventMap.set(handler.callback as EventCallback<EventParamsDefinition[Evt]>, {
        eventType: eType,
        event: composedEvent
      });
    } else {
      this._eventDispatcher.register(eType, handler);
      this._addEventHandler(eType, handler as unknown as EventHandler<EventParams>);
    }

    return this;
  }

  off<Evt extends EventType>(eType: Evt, callback?: EventCallback<EventParamsDefinition[Evt]>): this;
  off<Evt extends EventType>(eType: Evt, query: EventQuery, callback: EventCallback<EventParamsDefinition[Evt]>): this;
  off<Evt extends EventType>(
    eType: Evt,
    query?: EventQuery | EventCallback<EventParamsDefinition[Evt]>,
    cb?: EventCallback<EventParamsDefinition[Evt]>
  ): this {
    const callback = (cb ?? query) as EventCallback<EventParamsDefinition[Evt]>;
    const ComposedEventCtor = Factory.getComposedEvent(eType);

    if (!!ComposedEventCtor) {
      if (callback) {
        this._composedEventMap.get(callback)?.event.unregister();
        this._composedEventMap.delete(callback);
      } else {
        for (const entry of this._composedEventMap.entries()) {
          if (entry[1].eventType === eType) {
            this._composedEventMap.get(entry[0])?.event.unregister();
            this._composedEventMap.delete(entry[0]);
          }
        }
      }
    } else {
      if (callback) {
        const storedHandler = this._getEventHandler(eType, callback as EventCallback<EventParams>);
        const handler: EventHandler<EventParamsDefinition[Evt]> = (storedHandler as unknown as EventHandler<
          EventParamsDefinition[Evt]
        >) ?? {
          callback,
          query: null,
          // 卸载事件时无需处理 source 以外的参数
          filter: {
            nodeName: null,
            type: eType,
            level: null,
            source: (query as EventQuery).source,
            markName: null,
            filter: null,
            userId: null
          }
        };
        this._eventDispatcher.unregister(eType, handler);
        this._removeEventHandler(eType, callback as EventCallback<EventParams>);
      } else {
        this._eventDispatcher.unregister(eType);
        this._eventHandlerMap.delete(eType);
      }
    }
    return this;
  }

  emit<Evt extends EventType>(eType: Evt, params: EventParamsDefinition[Evt], level?: EventBubbleLevel): this {
    this._eventDispatcher.dispatch(eType, params, level);
    return this;
  }

  prevent<Evt extends EventType>(
    eType: Evt,
    except?: {
      handler: EventCallback<EventParamsDefinition[Evt]>;
      level: EventBubbleLevel;
    }
  ): this {
    this._eventDispatcher.prevent(eType, except);
    return this;
  }

  allow<Evt extends EventType>(eType: Evt) {
    this._eventDispatcher.allow(eType);
    return this;
  }

  release(): void {
    this._eventHandlerMap.forEach((handlers, eventType) => {
      handlers.forEach(handler => {
        this._eventDispatcher.unregister(eventType, handler);
      });
    });
    this._eventHandlerMap.clear();
    this._composedEventMap.forEach(entry => {
      entry.event.unregister();
    });
    this._composedEventMap.clear();
  }

  private _addEventHandler(eventType: EventType, handler: EventHandler<EventParams>) {
    if (!handler.callback) {
      return;
    }
    if (!this._eventHandlerMap.has(eventType)) {
      this._eventHandlerMap.set(eventType, new Map());
    }
    this._eventHandlerMap.get(eventType).set(handler.callback, handler);
  }

  private _getEventHandler(eventType: EventType, callback: EventCallback<EventParams>) {
    return this._eventHandlerMap.get(eventType)?.get(callback);
  }

  private _removeEventHandler(eventType: EventType, callback: EventCallback<EventParams>) {
    const handlerMap = this._eventHandlerMap.get(eventType);
    if (!handlerMap) {
      return;
    }
    handlerMap.delete(callback);
    if (!handlerMap.size) {
      this._eventHandlerMap.delete(eventType);
    }
  }
}
