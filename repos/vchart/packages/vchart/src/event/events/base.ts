import type { EventHandler, EventParamsDefinition, EventType, IComposedEvent, IEventDispatcher } from '../interface';
import type { Maybe, RenderMode, ValueOf } from '../../typings';
import type { IChart } from '../../chart/interface';

export abstract class ComposedEvent implements IComposedEvent {
  protected _eventMap: Map<string, EventHandler<ValueOf<EventParamsDefinition>>> = new Map<
    string,
    EventHandler<ValueOf<EventParamsDefinition>>
  >();
  protected _eventDispatcher: IEventDispatcher;
  protected _mode: RenderMode;
  protected _chart: Maybe<IChart>;

  constructor(eventDispatcher: IEventDispatcher, mode: RenderMode) {
    this._eventDispatcher = eventDispatcher;
    this._mode = mode;

    this._chart = this._eventDispatcher.globalInstance.getChart?.();
  }

  abstract register<Evt extends EventType>(eType: string, handler: EventHandler<EventParamsDefinition[Evt]>): void;
  abstract unregister(): void;
  abstract dispatch(v: unknown, opt: unknown): unknown;

  protected _registerEvent<Evt extends EventType>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>) {
    this._eventMap.set(eType, handler);
    this._eventDispatcher.register(eType, handler);
    return this._eventDispatcher;
  }

  protected _unregisterEvent<Evt extends EventType>(eType: Evt, handler?: EventHandler<EventParamsDefinition[Evt]>) {
    // this._eventMap.delete(eType, handler);
    this._eventDispatcher.register(eType, handler);
    return this._eventDispatcher;
  }
}
