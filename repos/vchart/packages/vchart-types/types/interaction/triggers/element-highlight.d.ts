import type { IElementHighlightOptions, ITrigger } from '../interface/trigger';
import type { IMarkGraphic } from '../../mark/interface/common';
import { BaseTrigger } from './base';
import type { GraphicEventType } from '@visactor/vrender-core';
import type { BaseEventParams } from '../../event/interface';
export declare class ElementHighlight extends BaseTrigger<IElementHighlightOptions> implements ITrigger<IElementHighlightOptions> {
    static type: string;
    type: string;
    static defaultOptions: Partial<IElementHighlightOptions>;
    protected _lastGraphic?: IMarkGraphic;
    constructor(options?: IElementHighlightOptions);
    getStartState(): string;
    getResetState(): string;
    protected _resetType?: 'view' | 'self';
    protected getEvents(): {
        type: GraphicEventType;
        handler: (e: BaseEventParams) => void;
    }[];
    resetAll: (e?: BaseEventParams) => void;
    handleStart: (e: BaseEventParams) => void;
    handleReset: (e: BaseEventParams) => void;
    start(markGraphic: IMarkGraphic, e?: BaseEventParams): void;
    reset(markGraphic: IMarkGraphic, e?: BaseEventParams): void;
}
export declare const registerElementHighlight: () => void;
