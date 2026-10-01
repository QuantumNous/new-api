import type { GraphicEventType } from '@visactor/vrender-core';
import type { IMark, IMarkGraphic } from '../../mark/interface/common';
import type { RenderMode } from '../../typings/spec/common';
import type { IInteraction } from './common';
import type { BaseEventParams } from '../../event/interface';
export type ITriggerEventHandler = (e: any, markGraphic?: IMarkGraphic) => void;
export interface ITrigger<TriggerOptions extends IBaseTriggerOptions = any> {
    readonly options: TriggerOptions;
    readonly type: string;
    registerMark: (mark: IMark | IMark[]) => void;
    release: () => void;
    init: () => void;
    start: (g: any, e?: BaseEventParams) => void;
    reset: (g?: IMarkGraphic) => void;
    getStartState: () => string;
    getResetState: () => string;
    updateMarkIdByState: (states: string[]) => void;
    getMarkIdByState: () => Record<string, number[]>;
    getMarks: () => IMark[];
    getMarksByState: (state: string) => IMark[];
}
export interface IBaseTriggerOptions {
    type?: string;
    marks?: IMark[];
    mode?: RenderMode;
    event: {
        on: (eType: string, callback: ITriggerEventHandler) => void;
        off: (eType: string, callback?: ITriggerEventHandler) => void;
        emit: (eType: string, params: any) => void;
    };
    interaction: IInteraction;
    id?: string;
    shouldStart?: (e: any) => boolean;
    shouldUpdate?: (e: any) => boolean;
    shouldEnd?: (e: any) => boolean;
    shouldReset?: (e: any) => boolean;
    onStart?: (e: any) => boolean;
    onUpdate?: (e: any) => boolean;
    onEnd?: (e: any) => boolean;
    onReset?: (e: any) => boolean;
}
export type IElementSelectTriggerOff = GraphicEventType | string | 'empty' | 'none' | number;
export interface IElementSelectOptions extends IBaseTriggerOptions {
    trigger?: GraphicEventType | GraphicEventType[];
    state?: string;
    reverseState?: string;
    triggerOff?: IElementSelectTriggerOff | IElementSelectTriggerOff[];
    isMultiple?: boolean;
}
export interface IDimensionHoverOptions extends IBaseTriggerOptions {
    state?: string;
    reverseState?: string;
    trigger?: string;
}
export interface IElementActiveOptions extends IBaseTriggerOptions {
    trigger?: GraphicEventType | GraphicEventType[];
    triggerOff?: GraphicEventType | GraphicEventType[] | 'none';
    state?: string;
}
export interface IElementHighlightOptions extends IBaseTriggerOptions {
    trigger?: GraphicEventType;
    triggerOff?: GraphicEventType | 'none';
    highlightState?: string;
    blurState?: string;
}
export interface IElementFilterOptions {
    filterType?: 'key' | 'groupKey';
    filterField?: string;
}
export interface IElementActiveByLegendOptions extends IBaseTriggerOptions, IElementFilterOptions {
    state?: string;
}
export interface IElementHighlightByLegendOptions extends IBaseTriggerOptions, IElementFilterOptions {
    highlightState?: string;
    blurState?: string;
}
export interface IElementHighlightByNameOptions extends IElementHighlightByLegendOptions {
    graphicName?: string | string[];
    trigger?: GraphicEventType;
    triggerOff?: GraphicEventType | 'none';
    parseData?: (e: BaseEventParams) => any;
}
export type IElementHighlightByGraphicNameOptions = IElementHighlightOptions;
export interface ITriggerConstructor<T extends IBaseTriggerOptions = IBaseTriggerOptions> {
    readonly type: string;
    new (options?: T): ITrigger<T>;
}
