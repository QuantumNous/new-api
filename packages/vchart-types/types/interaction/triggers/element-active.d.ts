import { BaseTrigger } from './base';
import type { IElementActiveOptions, ITrigger, ITriggerEventHandler } from '../interface/trigger';
import type { IMarkGraphic } from '../../mark/interface';
import type { BaseEventParams } from '../../event/interface';
export declare class ElementActive extends BaseTrigger<IElementActiveOptions> implements ITrigger<IElementActiveOptions> {
    static type: string;
    type: string;
    static defaultOptions: Partial<IElementActiveOptions>;
    constructor(options?: IElementActiveOptions);
    protected getEvents(): Array<{
        type: string | string[];
        handler: ITriggerEventHandler;
    }>;
    getStartState(): string;
    start(g: IMarkGraphic): void;
    reset(graphic?: IMarkGraphic): void;
    handleStart: (e: BaseEventParams) => void;
    handleReset: (e: BaseEventParams) => void;
}
export declare const registerElementActive: () => void;
