import { BaseTrigger } from './base';
import type { IElementHighlightOptions, ITrigger, ITriggerEventHandler } from '../interface/trigger';
import type { IMarkGraphic } from '../../mark/interface';
import type { BaseEventParams } from '../../core';
export declare class ElementHighlightByGroup extends BaseTrigger<IElementHighlightOptions> implements ITrigger<IElementHighlightOptions> {
    static type: string;
    type: string;
    static defaultOptions: Partial<IElementHighlightOptions>;
    constructor(options?: IElementHighlightOptions);
    getStartState(): string;
    getResetState(): string;
    protected getEvents(): Array<{
        type: string | string[];
        handler: ITriggerEventHandler;
    }>;
    resetAll(): void;
    protected _getHightlightKey(g: IMarkGraphic): string;
    start(g: IMarkGraphic): void;
    reset(g?: IMarkGraphic): void;
    handleStart: (e: BaseEventParams) => void;
    handleReset: (e: BaseEventParams) => void;
}
export declare const registerElementHighlightByGroup: () => void;
