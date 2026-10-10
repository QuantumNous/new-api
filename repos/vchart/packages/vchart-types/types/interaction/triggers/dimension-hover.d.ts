import type { DimensionEventParams } from '../../event/events/dimension/interface';
import type { IMarkGraphic } from '../../mark/interface';
import type { IDimensionHoverOptions, ITrigger } from '../interface/trigger';
import { BaseTrigger } from './base';
export declare class DimensionHover extends BaseTrigger<IDimensionHoverOptions> implements ITrigger<IDimensionHoverOptions> {
    static type: string;
    type: string;
    static defaultOptions: Partial<IDimensionHoverOptions>;
    protected _resetType: ('view' | 'self' | 'timeout')[];
    protected _statedGraphics?: IMarkGraphic[];
    constructor(options?: IDimensionHoverOptions);
    getStartState(): string;
    getResetState(): string;
    protected getEvents(): {
        type: string;
        handler: (params: DimensionEventParams) => void;
    }[];
    resetAll: () => void;
    protected getStatedGraphics(params: DimensionEventParams, reverse?: boolean): IMarkGraphic[];
    handleStart: (params: DimensionEventParams) => void;
}
export declare const registerDimensionHover: () => void;
