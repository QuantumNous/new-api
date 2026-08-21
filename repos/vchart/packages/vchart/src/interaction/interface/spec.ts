import type { EventType } from '../../event/interface';
import type { StringOrNumber } from '../../typings/common';
import type {
  IElementActiveByLegendOptions,
  IElementActiveOptions,
  IElementHighlightByLegendOptions,
  IElementHighlightByNameOptions,
  IElementHighlightOptions,
  IElementSelectOptions
} from './trigger';

export interface IBaseInteractionSpec {
  /**
   * 触发交互的图元id
   */
  markIds?: StringOrNumber[];
  /**
   * 触发交互的图元名称
   */
  markNames?: StringOrNumber[];
}

type Trigger = EventType | EventType[];

/**
 * hover 交互详细配置内容
 */
export interface IHoverSpec extends IBaseInteractionSpec {
  /**
   * hover 交互开关，默认开启
   */
  enable?: boolean;
  /**
   * hover 交互的触发事件配置
   */
  trigger?: Trigger;
  /**
   * hover 交互的终止事件配置
   */
  triggerOff?: Trigger;
}

/**
 * select 交互详细配置内容
 */
export interface ISelectSpec extends IBaseInteractionSpec {
  /**
   * select 交互开关，默认开启。
   */
  enable?: boolean;
  /**
   * 选中模式配置，默认 single 单选
   */
  mode?: 'single' | 'multiple';
  /**
   * select 交互的触发事件配置
   */
  trigger?: Trigger;
  /**
   * select 交互的终止事件配置
   */
  triggerOff?: Trigger | number;
}

/**
 * 将触发元素的状态设置为激活状态，当开启这个交互的时候，可以在系列图元通过 `state.active` 设置激活状态下的视觉编码
 */
export type IElementActiveSpec = IBaseInteractionSpec &
  Pick<IElementActiveOptions, 'trigger' | 'triggerOff' | 'state'> & {
    /**
     * 设置交互的类型为 'element-active'
     */
    type: 'element-active';
  };

/**
 * 图元选中相关交互，当开启这个交互的时候，
 * 可以在系列图元通过 `state.selected` 设置激活状态下的视觉编码
 * 可以在系列图元通过 `state.selected_reverse` 设置非激活状态下的视觉编码
 */
export type IElementSelectSpec = IBaseInteractionSpec &
  Pick<IElementSelectOptions, 'trigger' | 'triggerOff' | 'state' | 'isMultiple' | 'reverseState'> & {
    /**
     * 设置交互的类型为 'element-select'
     */
    type: 'element-select';
  };
/**
 * 图元高亮交互配置，当开启这个交互的时候，
 * 可以在系列图元通过 `state.highlight` 设置激活状态下的视觉编码
 * 可以在系列图元通过 `state.blur` 设置非激活状态下的视觉编码
 */
export type IElementHighlightSpec = IBaseInteractionSpec &
  Pick<IElementHighlightOptions, 'blurState' | 'highlightState' | 'triggerOff' | 'trigger'> & {
    /**
     * 设置交互的类型为 'element-highlight'
     */
    type: 'element-highlight';
  };
/**
 * 将触发元素以及和触发元素具有相同key的元素状态设置为高亮状态，其他元素的状态设置为失焦状态；一般需要配合系列的dataKey 配置使用
 */
export type IElementHighlightByKeySpec = IBaseInteractionSpec &
  Pick<IElementHighlightOptions, 'blurState' | 'highlightState' | 'triggerOff' | 'trigger'> & {
    /**
     * 设置交互的类型为 'element-highlight-by-key'
     */
    type: 'element-highlight-by-key';
  };
/**
 * 将触发元素以及和触发元素具有相同分组值（groupKey）的元素状态设置为高亮状态，其他元素的状态设置为失焦状态
 */
export type IElementHighlightByGroup = IBaseInteractionSpec &
  Pick<IElementHighlightOptions, 'blurState' | 'highlightState' | 'triggerOff' | 'trigger'> & {
    /**
     * 设置交互的类型为 'element-highlight-by-group'
     */
    type: 'element-highlight-by-group';
  };
/**
 * 根据图例激活图元，默认触发事件为图例的 `legendItemHover`和`legendItemUnHover`事件
 */
export type IElementActiveByLegend = IBaseInteractionSpec &
  Pick<IElementActiveByLegendOptions, 'filterType' | 'state'> & {
    /**
     * 设置交互的类型为 'element-active-by-legend'
     */
    type: 'element-active-by-legend';
  };
/**
 * 根据图例高亮图元，默认触发事件为图例的 `legendItemHover`和`legendItemUnHover`事件
 */
export type IElementHighlightByLegend = IBaseInteractionSpec &
  Pick<IElementHighlightByLegendOptions, 'filterType' | 'blurState' | 'highlightState'> & {
    /**
     * 设置交互的类型为'element-highlight-by-legend'
     */
    type: 'element-highlight-by-legend';
  };
/**
 * 根据图例高亮图元，默认触发事件为图例的 `legendItemHover`和`legendItemUnHover`事件
 */
export type IElementHighlightByName = IBaseInteractionSpec &
  Pick<IElementHighlightByNameOptions, 'blurState' | 'highlightState' | 'graphicName' | 'parseData'> & {
    /**
     * 设置交互的类型为'element-highlight-by-name'
     */
    type: 'element-highlight-by-name';
  };

/**
 * 元素选中交互，将所有相同名称的元素的状态设置为选中状态；注意该交互不建议和默认的select交互同时使用（象形图除外）
 */
export interface ICustomInteraction extends IBaseInteractionSpec {
  type: string;
}

/**
 * 交互相关配置，目前支持的交互类型包括：
 * - 元素激活
 * - 元素选中
 * - 元素高亮
 * - 根据key值高亮元素
 * - 根据group值高亮元素
 * - 根据legend值激活元素
 * - 根据legend值高亮元素
 * - 根据图元名称高亮元素
 */
export type IInteractionItemSpec =
  | IElementActiveSpec
  | IElementSelectSpec
  | IElementHighlightSpec
  | IElementHighlightByKeySpec
  | IElementHighlightByGroup
  | IElementActiveByLegend
  | IElementHighlightByLegend
  | IElementHighlightByName
  | ICustomInteraction;

/**
 *  申明图表交互相关配置
 */
export interface IInteractionSpec {
  /**
   * 图表hover相关交互配置，当值为boolean类型时，表示开启或者关闭该交互
   * 也支持更详细的交互配置
   */
  hover?: IHoverSpec | boolean;
  /**
   * 图表选中相关交互配置，当值为boolean类型时，表示开启或者关闭该交互
   * 也支持更详细的交互配置
   */
  select?: ISelectSpec | boolean;
  /**
   * 其他需要按需注册的类型交互
   */
  interactions?: IInteractionItemSpec[];
}
