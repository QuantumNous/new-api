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
  /**
   * 需要处理状态的所有图元
   */
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
  /**
   * the trigger event name
   */
  trigger?: GraphicEventType | GraphicEventType[];
  /**
   * the selected state name
   */
  state?: string;
  /**
   * the non-selected state name
   */
  reverseState?: string;
  /**
   * the reset trigger event name
   */
  triggerOff?: IElementSelectTriggerOff | IElementSelectTriggerOff[];
  /**
   * whether or not support multiple selected
   */
  isMultiple?: boolean;
}

export interface IDimensionHoverOptions extends IBaseTriggerOptions {
  /**
   * the selected state name
   */
  state?: string;
  /**
   * the non-selected state name
   */
  reverseState?: string;

  trigger?: string;
}

export interface IElementActiveOptions extends IBaseTriggerOptions {
  /**
   * the trigger event name
   */
  trigger?: GraphicEventType | GraphicEventType[];
  /**
   * the reset trigger event name
   */
  triggerOff?: GraphicEventType | GraphicEventType[] | 'none';
  /**
   * the active state name
   */
  state?: string;
}

export interface IElementHighlightOptions extends IBaseTriggerOptions {
  /**
   * the trigger event name
   */
  trigger?: GraphicEventType;
  /**
   * the reset trigger event name
   */
  triggerOff?: GraphicEventType | 'none';
  /**
   * the highlight state name
   */
  highlightState?: string;
  /**
   * the blur state name
   */
  blurState?: string;
}

export interface IElementFilterOptions {
  /**
   * the filter type of element
   */
  filterType?: 'key' | 'groupKey';
  /**
   * the field to be filtered
   */
  filterField?: string;
}

/**
 * the interaction to set the active state of specified marks trigger by legend
 */
export interface IElementActiveByLegendOptions extends IBaseTriggerOptions, IElementFilterOptions {
  /**
   * the active state name
   */
  state?: string;
}

/**
 * the interaction to set the active state of specified marks trigger by legend
 */
export interface IElementHighlightByLegendOptions extends IBaseTriggerOptions, IElementFilterOptions {
  /**
   * the highlight state name
   */
  highlightState?: string;
  /**
   * the blur state name
   */
  blurState?: string;
}

export interface IElementHighlightByNameOptions extends IElementHighlightByLegendOptions {
  graphicName?: string | string[];
  /**
   * the trigger event name
   */
  trigger?: GraphicEventType;
  /**
   * the reset trigger event name
   */
  triggerOff?: GraphicEventType | 'none';

  parseData?: (e: BaseEventParams) => any;
}

export type IElementHighlightByGraphicNameOptions = IElementHighlightOptions;

export interface ITriggerConstructor<T extends IBaseTriggerOptions = IBaseTriggerOptions> {
  readonly type: string;

  new (options?: T): ITrigger<T>;
}
