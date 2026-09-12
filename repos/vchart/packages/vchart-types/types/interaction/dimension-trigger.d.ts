import type { IElement } from '@visactor/vgrammar-core';
import type { DimensionEventParams } from '../event/events/dimension/interface';
import type { IMark } from '../mark/interface';
import type { IEvent } from '../event/interface';
import type { IHoverSpec, IInteraction, ISelectSpec, ITrigger, ITriggerOption } from './interface';
import { MarkSet } from '../mark/mark-set';
export declare class DimensionTrigger implements ITrigger {
    readonly event: IEvent;
    protected readonly interaction: IInteraction;
    protected _option: ITriggerOption;
    protected _marks: MarkSet;
    protected _markReverse: MarkSet;
    private _hover;
    get hover(): IHoverSpec;
    private _select;
    get select(): ISelectSpec;
    constructor(option: ITriggerOption);
    setStateKeys(fields: string[]): void;
    registerMark(mark: IMark): void;
    init(): void;
    release(): void;
    protected initEvent(): void;
    protected releaseEvent(): void;
    private initConfig;
    protected getEventElement(params: DimensionEventParams, reverse?: boolean): IElement[];
    private onHover;
}
