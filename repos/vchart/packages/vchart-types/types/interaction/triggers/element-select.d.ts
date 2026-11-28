import type { IElementSelectOptions, ITrigger } from '../interface/trigger';
import type { IMarkGraphic } from '../../mark/interface/common';
import { BaseTrigger } from './base';
import type { BaseEventParams } from '../../event/interface';
export declare class ElementSelect extends BaseTrigger<IElementSelectOptions> implements ITrigger<IElementSelectOptions> {
    static type: string;
    type: string;
    static defaultOptions: Partial<IElementSelectOptions>;
    protected _resetType: ('view' | 'self' | 'timeout')[];
    private _timer?;
    constructor(options?: IElementSelectOptions);
    getStartState(): string;
    getResetState(): string;
    protected getEvents(): {
        type: import("@visactor/vrender-core").GraphicEventType | import("@visactor/vrender-core").GraphicEventType[];
        handler: (e: BaseEventParams) => void;
    }[];
    resetAll: (e?: BaseEventParams) => void;
    handleStart: (e: BaseEventParams) => void;
    handleReset: (e: BaseEventParams) => void;
    start(markGraphic: IMarkGraphic, e?: BaseEventParams): void;
    reset(markGraphic: IMarkGraphic, e?: BaseEventParams): void;
}
export declare const registerElementSelect: () => void;
