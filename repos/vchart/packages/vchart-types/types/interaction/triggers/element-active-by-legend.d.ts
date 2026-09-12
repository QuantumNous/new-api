import { BaseTrigger } from './base';
import type { IElementActiveByLegendOptions, ITrigger, ITriggerEventHandler } from '../interface/trigger';
import type { IMarkGraphic } from '../../mark/interface';
import type { BaseEventParams } from '../../core';
export declare class ElementActiveByLegend extends BaseTrigger<IElementActiveByLegendOptions> implements ITrigger<IElementActiveByLegendOptions> {
    static type: string;
    type: string;
    static defaultOptions: Partial<IElementActiveByLegendOptions>;
    constructor(options?: IElementActiveByLegendOptions);
    protected getEvents(): Array<{
        type: string | string[];
        handler: ITriggerEventHandler;
    }>;
    getStartState(): string;
    start(itemKey: string): void;
    resetAll(): void;
    reset(g?: IMarkGraphic): void;
    handleStart: (e: BaseEventParams) => void;
    handleReset: (e: BaseEventParams) => void;
}
export declare const registerElementActiveByLegend: () => void;
