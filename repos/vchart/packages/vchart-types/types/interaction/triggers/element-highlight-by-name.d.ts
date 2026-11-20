import { BaseTrigger } from './base';
import type { IElementHighlightByNameOptions, ITrigger } from '../interface/trigger';
import type { BaseEventParams } from '../../event/interface';
import type { IMarkGraphic } from '../../mark/interface';
export declare class ElementHighlightByName extends BaseTrigger<IElementHighlightByNameOptions> implements ITrigger<IElementHighlightByNameOptions> {
    static type: string;
    type: string;
    static defaultOptions: Partial<IElementHighlightByNameOptions>;
    constructor(options?: IElementHighlightByNameOptions);
    getStartState(): string;
    getResetState(): string;
    protected getEvents(): {
        type: "none" | import("@visactor/vrender-core").GraphicEventType;
        handler: (e: BaseEventParams) => void;
    }[];
    protected _filterByName(e: BaseEventParams): boolean;
    protected _parseTargetKey(e: BaseEventParams): any;
    start(itemKey: any): void;
    resetAll(): void;
    reset(g?: IMarkGraphic): void;
    handleStart: (e: BaseEventParams) => void;
    handleReset: (e: BaseEventParams) => void;
}
export declare const registerElementHighlightByName: () => void;
