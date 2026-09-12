import type { EventType } from '../../event/interface';
import type { StringOrNumber } from '../../typings/common';
import type { IElementActiveByLegendOptions, IElementActiveOptions, IElementHighlightByLegendOptions, IElementHighlightByNameOptions, IElementHighlightOptions, IElementSelectOptions } from './trigger';
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
export type IElementActiveSpec = IBaseInteractionSpec & Pick<IElementActiveOptions, 'trigger' | 'triggerOff' | 'state'> & {
    type: 'element-active';
};
export type IElementSelectSpec = IBaseInteractionSpec & Pick<IElementSelectOptions, 'trigger' | 'triggerOff' | 'state' | 'isMultiple' | 'reverseState'> & {
    type: 'element-select';
};
export type IElementHighlightSpec = IBaseInteractionSpec & Pick<IElementHighlightOptions, 'blurState' | 'highlightState' | 'triggerOff' | 'trigger'> & {
    type: 'element-highlight';
};
export type IElementHighlightByKeySpec = IBaseInteractionSpec & Pick<IElementHighlightOptions, 'blurState' | 'highlightState' | 'triggerOff' | 'trigger'> & {
    type: 'element-highlight-by-key';
};
export type IElementHighlightByGroup = IBaseInteractionSpec & Pick<IElementHighlightOptions, 'blurState' | 'highlightState' | 'triggerOff' | 'trigger'> & {
    type: 'element-highlight-by-group';
};
export type IElementActiveByLegend = IBaseInteractionSpec & Pick<IElementActiveByLegendOptions, 'filterType' | 'state'> & {
    type: 'element-active-by-legend';
};
export type IElementHighlightByLegend = IBaseInteractionSpec & Pick<IElementHighlightByLegendOptions, 'filterType' | 'blurState' | 'highlightState'> & {
    type: 'element-highlight-by-legend';
};
export type IElementHighlightByName = IBaseInteractionSpec & Pick<IElementHighlightByNameOptions, 'blurState' | 'highlightState' | 'graphicName' | 'parseData'> & {
    type: 'element-highlight-by-name';
};
export interface ICustomInteraction extends IBaseInteractionSpec {
    type: string;
}
export type IInteractionItemSpec = IElementActiveSpec | IElementSelectSpec | IElementHighlightSpec | IElementHighlightByKeySpec | IElementHighlightByGroup | IElementActiveByLegend | IElementHighlightByLegend | IElementHighlightByName | ICustomInteraction;
export interface IInteractionSpec {
    hover?: IHoverSpec | boolean;
    select?: ISelectSpec | boolean;
    interactions?: IInteractionItemSpec[];
}
export {};
