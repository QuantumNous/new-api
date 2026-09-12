import type { ElementActiveByLegendSpec, ElementActiveSpec, ElementHighlightByGroupSpec, ElementHighlightByKeySpec, ElementHighlightByLegendSpec, ElementHighlightByNameSpec, ElementHighlightSpec, ElementSelectSpec, IElement, IInteraction as IVGrammarInteraction } from '@visactor/vgrammar-core';
import type { IMark } from '../mark/interface';
import type { RenderMode } from '../typings/spec/common';
import type { BaseEventParams, IEventDispatcher, EventType } from '../event/interface';
import type { IModel } from '../model/interface';
import type { StateValue } from '../compile/mark/interface';
import type { StringOrNumber } from '../typings/common';
export interface IInteraction {
    registerMark: (state: StateValue, mark: IMark) => void;
    filterEventMark: (params: BaseEventParams, state: StateValue) => boolean;
    getStateMark: (state: StateValue) => IMark[] | null;
    getEventElement: (stateValue: StateValue) => IElement[];
    getEventElementData: (stateValue: StateValue) => any[];
    addEventElement: (stateValue: StateValue, element: IElement) => void;
    removeEventElement: (stateValue: StateValue, elements: IElement) => void;
    exchangeEventElement: (stateValue: StateValue, elements: IElement) => void;
    clearEventElement: (stateValue: StateValue, clearReverse: boolean) => void;
    reverseEventElement: (stateValue: StateValue) => void;
    clearAllEventElement: () => void;
    setDisableActiveEffect: (disable: boolean) => void;
    addVgrammarInteraction: (state: StateValue, i: IVGrammarInteraction) => void;
    startInteraction: (state: StateValue, element: IElement) => void;
    resetInteraction: (state: StateValue, element: IElement) => void;
    resetAllInteraction: () => void;
}
export interface ITrigger {
    init: () => void;
    setStateKeys: (fields: string[]) => void;
    registerMark: (mark: IMark) => void;
    release: () => void;
    hover?: IHoverSpec;
    select?: ISelectSpec;
}
export interface ITriggerOption {
    mode: RenderMode;
    interaction: IInteraction;
    eventDispatcher: IEventDispatcher;
    model: IModel;
}
export interface IBaseInteractionSpec {
    markIds?: StringOrNumber[];
    markNames?: StringOrNumber[];
}
type Trigger = EventType | EventType[];
export interface IHoverSpec extends IBaseInteractionSpec {
    enable?: boolean;
    trigger?: Trigger;
    triggerOff?: Trigger;
}
export interface ISelectSpec extends IBaseInteractionSpec {
    enable?: boolean;
    mode?: 'single' | 'multiple';
    trigger?: Trigger;
    triggerOff?: Trigger | number;
}
export type IElementActiveSpec = IBaseInteractionSpec & Pick<ElementActiveSpec, 'type' | 'trigger' | 'triggerOff' | 'state'>;
export type IElementSelectSpec = IBaseInteractionSpec & Pick<ElementSelectSpec, 'type' | 'trigger' | 'triggerOff' | 'state' | 'isMultiple' | 'reverseState'>;
export type IElementHighlightSpec = IBaseInteractionSpec & Pick<ElementHighlightSpec, 'type' | 'blurState' | 'highlightState' | 'triggerOff' | 'trigger'>;
export type IElementHighlightByKeySpec = IBaseInteractionSpec & Pick<ElementHighlightByKeySpec, 'type' | 'blurState' | 'highlightState' | 'triggerOff' | 'trigger'>;
export type IElementHighlightByGroup = IBaseInteractionSpec & Pick<ElementHighlightByGroupSpec, 'type' | 'blurState' | 'highlightState' | 'triggerOff' | 'trigger'>;
export type IElementActiveByLegend = IBaseInteractionSpec & Pick<ElementActiveByLegendSpec, 'type' | 'filterType' | 'state'>;
export type IElementHighlightByLegend = IBaseInteractionSpec & Pick<ElementHighlightByLegendSpec, 'type' | 'filterType' | 'blurState' | 'highlightState'>;
export type IElementHighlightByName = IBaseInteractionSpec & Pick<ElementHighlightByNameSpec, 'type' | 'blurState' | 'highlightState' | 'graphicName' | 'parseData'>;
export interface ICustomInteraction extends IBaseInteractionSpec {
    type: string;
}
export type IInteractionItemSpec = IElementActiveSpec | IElementSelectSpec | IElementHighlightSpec | IElementHighlightByKeySpec | IElementHighlightByGroup | IElementActiveByLegend | IElementHighlightByLegend | IElementHighlightByName;
export interface IInteractionSpec {
    hover?: IHoverSpec | boolean;
    select?: ISelectSpec | boolean;
    interactions?: IInteractionItemSpec[];
}
export {};
