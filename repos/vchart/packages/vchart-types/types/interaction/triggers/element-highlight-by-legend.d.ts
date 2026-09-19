import { BaseTrigger } from './base';
import type { IElementHighlightByLegendOptions, ITrigger, ITriggerEventHandler } from '../interface/trigger';
import type { IMarkGraphic } from '../../mark/interface/common';
import type { BaseEventParams } from '../../event/interface';
export declare class ElementHighlightByLegend extends BaseTrigger<IElementHighlightByLegendOptions> implements ITrigger<IElementHighlightByLegendOptions> {
    static type: string;
    type: string;
    static defaultOptions: Partial<IElementHighlightByLegendOptions>;
    constructor(options?: IElementHighlightByLegendOptions);
    getStartState(): string;
    getResetState(): string;
    protected getEvents(): Array<{
        type: string | string[];
        handler: ITriggerEventHandler;
    }>;
    start(itemKey: any): void;
    resetAll(): void;
    reset(g?: IMarkGraphic): void;
    handleStart: (e: BaseEventParams) => void;
    handleReset: (e: BaseEventParams) => void;
}
export declare const registerElementHighlightByLegend: () => void;
