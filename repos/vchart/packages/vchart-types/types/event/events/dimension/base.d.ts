import type { IAxis } from '../../../component/axis/interface';
import type { RenderMode } from '../../../typings/spec/common';
import type { BaseEventParams, EventHandler, EventParamsDefinition, IComposedEvent, IEventDispatcher } from '../../interface';
import type { IChart } from '../../../chart/interface';
import type { IDimensionInfo } from './interface';
import type { Maybe } from '../../../typings';
export declare class DimensionEvent implements IComposedEvent {
    protected _eventDispatcher: IEventDispatcher;
    protected _mode: RenderMode;
    protected _callback: (params: BaseEventParams) => void;
    protected _chart: Maybe<IChart>;
    constructor(eventDispatcher: IEventDispatcher, mode: RenderMode);
    private get chart();
    register<Evt extends string>(eType: Evt, handler: EventHandler<EventParamsDefinition[Evt]>): void;
    unregister(): void;
    protected getTargetDimensionInfo(x: number, y: number): IDimensionInfo[] | null;
    dispatch(v: unknown, opt: {
        filter?: (axis: IAxis) => boolean;
    }): IDimensionInfo[];
}
