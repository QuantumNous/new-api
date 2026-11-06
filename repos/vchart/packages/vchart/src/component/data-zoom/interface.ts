import type { BaseEventParams } from '../../event/interface';
import type { IOrientType } from '../../typings';
import type { IDelayType } from '../../typings/event';
import type { IComponentSpec } from '../base/interface';
import type { IComponent } from '../interface';

/** spec */
export interface IDataFilterComponentSpec extends Omit<IComponentSpec, 'width' | 'height'> {
  /**
   * 是否显示组件
   * @default true
   */
  visible?: boolean;
  /**
   * 组件位置
   * @default 'left'
   */
  orient?: IOrientType;

  /**
   * 组件宽度
   * @default 'auto'
   */
  width?: 'auto' | number;

  /**
   * 组件高度
   * @default 'auto'
   */
  height?: 'auto' | number;

  /**
   * 声明关联的映射字段
   */
  field?: string;
  /**
   * 关联的轴ID
   */
  axisId?: string;
  /**
   * 关联的轴序号
   */
  axisIndex?: number;

  /**
   * 组件关联的region索引，与axis关联的region取交集
   * 未配置：默认跟随axis控制的region
   * 已配置：用户配置与axis关联的region取交集
   * 配置优先级：index > id
   */
  regionIndex?: number | number[];
  /**
   * 起点配置（比例）：范围[0, 1]
   * @default 0
   */
  start?: number;

  /**
   * 终点配置（比例）：范围[0, 1]
   * @default 1
   */
  end?: number;

  /**
   * 起始点数据配置：没有配置的时候根据start和end进行转换
   */
  startValue?: number | string;
  endValue?: number | string;

  /** 数据过滤对应的数据字段 */
  valueField?: string;

  /**
   * start和end的配置模式：只有模式和配置匹配时才生效，比如rangeMode: ['percent', 'value'], 那么必须start和endValue都配置才可以生效
   */
  rangeMode?: [string, string];
  /**
   * 是否进行自动缩进
   */
  autoIndent?: boolean;
  /**
   * 是否为自动模式。开启以后，组件不会导致轴 scale 缩放，end、roam 等可能导致缩放的配置将被忽略，且组件可以自动消失
   * @since 1.4.0
   */
  auto?: boolean;
  /**
   * 是否锁定选择区域（或叫做数据窗口）的大小
   * @default false
   * @since 1.5.1
   */
  zoomLock?: boolean;
  /**
   * 用于限制窗口大小的最小值, [0, 1]
   * @default 0
   * @since 1.5.1
   */
  minSpan?: number;
  /**
   * 用于限制窗口大小的最大值, [0, 1]
   * @default 1
   * @since 1.5.1
   */
  maxSpan?: number;
  /**
   * 用于限制窗口大小的最小数据值, 仅在continous scale生效，优先级高于minSpan
   * @since 1.5.1
   */
  minValueSpan?: number;
  /**
   * 用于限制窗口大小的最大数据值, 仅在continous scale生效，优先级高于maxSpan
   * @since 1.5.1
   */
  maxValueSpan?: number;
  /**
   * 事件触发延迟类型, 不配置则视作未开启
   * @since 1.5.1
   */
  delayType?: IDelayType;
  /**
   * 事件触发延迟时长
   * @default 30
   * @since 1.5.1
   */
  delayTime?: number;
  /**
   * 漫游模式 - 缩放（画布内自由交互), 默认不开启
   * @default false
   * @since 1.5.1
   */
  roamZoom?: IRoamZoomSpec | boolean;
  /**
   * 漫游模式 - 拖拽（画布内自由交互), 默认不开启
   * @since 1.5.1
   */
  roamDrag?: IRoamDragSpec | boolean;
  /**
   * 漫游模式 - 滚动（画布内自由交互), 默认不开启
   * @since 1.5.1
   */
  roamScroll?: IRoamScrollSpec | boolean;
  /**
   * 是否在操作时动态更新视图
   * @since 1.5.1
   * @default true
   */
  realTime?: boolean;
  /**
   * 自定义domain
   * 当brush组件开启`zoomAfterBrush`时, 关联的dataZoom需要和axis保持一致, 否则刷取范围无法正确计算
   * @since 1.10.0
   */
  customDomain?: any[];
  /**
   * 自定义datazoom更新回调
   * @since 1.10.0
   */
  updateDataAfterChange?: (start: number, end: number, startValue: any, endValue: any) => void;
}

export interface IRoamDragSpec extends IRoamSpec {
  /**
   * 拖拽方向与滚动条移动方向是否相反
   * @default true
   */
  reverse?: boolean;
  /**
   * 自定义的事件过滤器，返回true则触发datazoom/scrollbar的更新
   * @since 1.13.5
   * @returns
   */
  filter?: (delta: [number, number], e?: BaseEventParams['event']) => boolean;
  /**
   * 仅在画布交互展示组件
   * @since 2.0.3
   */
  autoVisible?: boolean;
}

export interface IRoamScrollSpec extends IRoamSpec {
  /**
   * 滚动方向与滚动条移动方向是否相反
   * @default true
   */
  reverse?: boolean;
  /**
   * 自定义的事件过滤器，返回true则触发datazoom/scrollbar的更新
   * @since 1.13.5
   * @returns
   */
  filter?: (params: { scrollX: number; scrollY: number }, e?: BaseEventParams['event']) => boolean;
}

export interface IRoamZoomSpec extends IRoamSpec {
  /**
   * 是否开启聚焦缩放
   * @default true
   * 开启时, 默认以鼠标位置开始
   * 关闭时, 以画布中心缩放
   */
  focus?: boolean;
  /**
   * 自定义的事件过滤器，返回true则触发datazoom/scrollbar的更新
   * @since 1.13.5
   * @returns
   */
  filter?: (params: { zoomDelta: number; zoomX?: number; zoomY?: number }, e?: BaseEventParams['event']) => boolean;
}

export interface IRoamSpec {
  /**
   * 是否开启 缩放 / 拖拽 / 滚动
   * @default true
   */
  enable?: boolean;
  /**
   * 缩放 / 拖拽 / 滚动速率, 范围: [0, 1]
   * @default 1
   */
  rate?: number;
}

export interface IDataFilterComponent extends IComponent {
  setStartAndEnd: (
    start: number | string,
    end: number | string,
    rangeMode: ['percent' | 'value', 'percent' | 'value']
  ) => void;
  enableInteraction: () => void;
  disableInteraction: () => void;
  zoomIn: (location?: { x: number; y: number }) => void;
  zoomOut: (location?: { x: number; y: number }) => void;
}

export type IFilterMode = 'filter' | 'axis';
