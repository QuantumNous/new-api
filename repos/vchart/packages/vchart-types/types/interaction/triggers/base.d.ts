import type { IBaseTriggerOptions, ITrigger, ITriggerEventHandler } from '../interface/trigger';
import type { IMark, IMarkGraphic } from '../../mark/interface/common';
import { MarkSet } from '../../mark/mark-set';
import type { BaseEventParams } from '../../core';
export declare abstract class BaseTrigger<T extends IBaseTriggerOptions> implements ITrigger<T> {
    options: T;
    type: string;
    protected _markSet: MarkSet;
    protected _markIdByState: Record<string, number[]>;
    constructor(options: T);
    getMarks(): IMark[];
    getMarksByState(state: string): IMark[];
    registerMark(mark: IMark | IMark[]): void;
    updateMarkIdByState(states: string[]): void;
    getMarkIdByState(): Record<string, number[]>;
    isGraphicInStateMark(g: IMarkGraphic, state: string): boolean;
    isGraphicInMark(g: IMarkGraphic): boolean;
    protected abstract getEvents(): Array<{
        type: string | string[];
        handler: ITriggerEventHandler;
    }>;
    getStartState(): string;
    getResetState(): string;
    init(): void;
    release(): void;
    start(g: IMarkGraphic | string, e?: BaseEventParams): void;
    reset(g?: IMarkGraphic, e?: BaseEventParams): void;
    protected dispatchEvent(type: 'start' | 'reset' | 'update' | 'end', params: any): void;
}
