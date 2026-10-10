import type { EventHandler, EventParamsDefinition, EventType, IComposedEvent, IEventDispatcher } from '../interface';
import type { Maybe, RenderMode, ValueOf } from '../../typings';
import type { IChart } from '../../chart/interface';
export declare abstract class ComposedEvent implements IComposedEvent {
    protected _eventMap: Map<string, EventHandler<ValueOf<EventParamsDefinition>>>;
    protected _eventDispatcher: IEventDispatcher;
    protected _mode: RenderMode;
    protected _chart: Maybe<IChart>;
    constructor(eventDispatcher: IEventDispatcher, mode: RenderMode);
    abstract register<Evt extends EventType>(eType: string, handler: EventHandler<EventParamsDefinition[Evt]>): void;
    abstract unregister(): void;
    abstract dispatch(v: unknown, opt: unknown): unknown;
    protected _registerEvent<Evt extends EventType>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>): IEventDispatcher;
    protected _unregisterEvent<Evt extends EventType>(eType: Evt, handler?: EventHandler<EventParamsDefinition[Evt]>): IEventDispatcher;
}
