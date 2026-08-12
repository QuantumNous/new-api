import type { IVChart } from './../../core/interface';
import type { IImageMarkSpec } from '../visual';
import type { LayoutCallBack } from '../../layout/interface';
import type {
  DataSet,
  DataView,
  ISimplifyOptions,
  IFieldsOptions,
  IFilterOptions,
  IFoldOptions,
  IDsvParserOptions
} from '@visactor/vdataset';
import type { RegionSpec } from '../../region/interface';
import type { IHoverSpec, ISelectSpec, IInteractionSpec } from '../../interaction/interface/spec';
import type { IRenderOption } from '../../compile/interface';
import type { ISeriesTooltipSpec, ITooltipSpec } from '../../component/tooltip/interface';
// eslint-disable-next-line no-duplicate-imports
import type { ILayoutSpec } from '../../layout/interface';
// eslint-disable-next-line no-duplicate-imports
import type {
  ConvertToMarkStyleSpec,
  IArcMarkSpec,
  IAreaMarkSpec,
  IBoxPlotMarkSpec,
  ICommonSpec,
  IGroupMarkSpec,
  ILineMarkSpec,
  ILinkPathMarkSpec,
  IPathMarkSpec,
  IPolygonMarkSpec,
  IRectMarkSpec,
  IRuleMarkSpec,
  ISymbolMarkSpec,
  IRippleMarkSpec,
  ITextMarkSpec,
  IVisualSpecScale
} from '../visual';
import type { ISeriesStyle, SeriesType } from '../../series/interface';
import type { Datum, StringOrNumber } from '../common';
import type { IInvalidType } from '../data';
import type { IAnimationSpec, IMorphSeriesSpec } from '../../animation/spec';
import type { IPlayer } from '../../component/player/interface';
import type { IMark, IMarkProgressiveConfig, IMarkRaw, MarkTypeEnum } from '../../mark/interface';
import type { IDataZoomSpec } from '../../component/data-zoom/data-zoom/interface';
import type { IScrollBarSpec } from '../../component/data-zoom/scroll-bar/interface';
import type { ICrosshairSpec } from '../../component/crosshair/interface';
import type { ITheme } from '../../theme/interface';
import type { ITitleSpec } from '../../component/title/interface';
import type { IBrushSpec } from '../../component/brush/interface';
import type { ITotalLabelSpec } from '../../component/label/interface';
import type { ILegendSpec } from '../../component/legend/interface';
import type { ILayoutOrientPadding, ILayoutPaddingSpec } from '../layout';
import type { IColor, ICustomPath2D, IGraphic, IOption3D, IRichTextCharacter } from '@visactor/vrender-core';
import type { ICommonAxisSpec } from '../../component/axis/interface';
import type { IMediaQuerySpec } from './media-query';
import type { IModelSpec } from '../../model/interface';
import type { TooltipActiveType } from '../tooltip/handler';

export type IChartPadding = ILayoutOrientPadding | number;

/** chart option */
export interface IInitOption extends Omit<IRenderOption, 'pluginList'> {
  /**
   * **仅生效于浏览器环境。**
   * 图表挂载的父容器，可以直接指定容器 id，也可以传入 dom 对象
   */
  dom?: string | HTMLElement;
  /**
   * 除去选择 dom 属性进行挂载父容器，也可以使用 renderCanvas 属性直接传入 canvas 实例/ canvasId
   * 小程序/小组件环境请直接传入 id
   */
  renderCanvas?: string | HTMLCanvasElement;
  /** 数据集 */
  dataSet?: DataSet;
  /** 是否自适应容器大小 */
  autoFit?: boolean;
  /**
   * 是否开启动画
   */
  animation?: boolean;

  /**
   * 自定义布局函数
   */
  layout?: LayoutCallBack;

  /**
   * 当文本省略时，鼠标 hover 到文本上时是否显示 poptip
   * @default true
   */
  poptip?: boolean;

  /**
   * 报错的回调函数
   * @since 1.2.0
   */
  onError?: (...args: any[]) => void;

  /**
   * 默认主题（支持完整主题对象或者主题名称，主题名称需要提前在 `ThemeManager` 中注册）
   * @since 1.3.0
   */
  theme?: string | ITheme;

  /**
   * 是否关闭交互效果
   * @since 1.9.0
   * @default false
   */
  disableTriggerEvent?: boolean;

  /**
   * 组件内容展示配置
   * @since 2.0.11
   */
  componentShowContent?: {
    /**
     * tooltip 是否关闭内容展示
     * @default false
     */
    tooltip?: boolean | Partial<Record<TooltipActiveType, boolean>>;
    // crosshair 组件是否展示
    crosshair?: boolean;
  };

  /**
   * 当自动响应容器resize 事件时，触发resize 的间隔时长，单位毫秒
   * @since 1.12.5
   * @default 100
   */
  resizeDelay?: number;
}

export enum RenderModeEnum {
  'desktop-browser' = 'desktop-browser',
  'mobile-browser' = 'mobile-browser',
  'node' = 'node',
  'worker' = 'worker',
  'miniApp' = 'miniApp',
  'wx' = 'wx',
  'tt' = 'tt',
  'harmony' = 'harmony',
  'desktop-miniApp' = 'desktop-miniApp',
  'lynx' = 'lynx'
}
export type RenderMode = keyof typeof RenderModeEnum;

/** chart spec */
export interface IChartSpec {
  /** 图表类型 */
  type: string;
  /** 数据 */
  data?: IData;
  /** 画布宽度 */
  width?: number;
  /** 画布高度 */
  height?: number;
  /**
   * 图表宽高是否自适应容器，浏览器环境下默认为 true。
   * 该配置的优先级高于构造函数中的 autoFit 配置。
   * 如果用户配置了 width，则以用户配置的 width 为准，height 同理。
   */
  autoFit?: boolean;
  /**
   * 图表整体 padding 设置
   */
  padding?: ILayoutPaddingSpec;
  /**
   * 图表色系配置
   */
  color?: string[] | Omit<IVisualSpecScale<unknown, string>, 'id'>;
  /**
   * 系列
   * @description 仅在组合图中使用, 文档中除组合图外均未透出该配置
   */
  series?: ISeriesSpec[];
  /**
   * 系列样式
   * @description 仅在图表配置了seriesField时生效
   */
  seriesStyle?: ISeriesStyle;

  /**
   * 自动关闭动画的阀值，对应的是单系列data的长度
   * @since 1.2.0
   */
  animationThreshold?: number;

  /** hover 交互 */
  hover?: boolean | IHoverSpec;
  /** select 交互 */
  select?: boolean | ISelectSpec;

  /** region配置 */
  region?: RegionSpec[];
  /** 图表标题配置 */
  title?: ITitleSpec;
  /** 布局配置 */
  layout?: ILayoutSpec;
  /** 图例配置 */
  legends?: ILegendSpec | ILegendSpec[];
  /** 十字辅助线配置 */
  crosshair?: ICrosshairSpec | ICrosshairSpec[];
  /** tooltip配置 */
  tooltip?: ITooltipSpec;
  /** 播放器配置 */
  player?: IPlayer;
  /** 缩略轴配置 */
  dataZoom?: IDataZoomSpec | IDataZoomSpec[];
  /** 滚动条配置 */
  scrollBar?: IScrollBarSpec | IScrollBarSpec[];
  /** 框选配置 */
  brush?: IBrushSpec;
  /** 全局 scale 配置 */
  scales?: IVisualSpecScale<unknown, unknown>[];
  /** 自定义mark */
  customMark?: ICustomMarkSpec<EnableMarkType>[];
  /** 轴 */
  axes?: ICommonAxisSpec[];
  /**
   * 图表上的主题定义。
   * 可以直接配置主题名，前提是该主题名已经注册
   */
  theme?: Omit<ITheme, 'name'> | string;
  /**
   * 图表背景色配置，优先级高于构造函数中的 background 配置
   * 自1.11.6版本支持渐变色对象的配置
   */
  background?: IBackgroundSpec;

  // TODO：后续开放，现在仍有问题
  // poptip?: PopTipAttributes;
  // TODO: 补充动画配置

  /**
   * 堆积时是否逆序
   * @default false
   * @since 1.4.0
   */
  stackInverse?: boolean;
  /**
   * 堆积时是否排序
   * @default false
   * @since 1.10.4
   */
  stackSort?: boolean;
  /**
   * 媒体查询配置
   * @since 1.8.0
   */
  media?: IMediaQuerySpec;
}

export type IBackgroundSpec = IColor | ConvertToMarkStyleSpec<IGroupMarkSpec>;

/** data */
export type IDataType = IDataValues | DataView;
export type IData = IDataType | IDataType[];
export type DataKeyType = string | string[] | ((data: Datum, index: number) => string);
export type BuildInTransformOptions =
  | {
      /** 地理数据简化 */
      type: 'simplify';
      options: ISimplifyOptions;
    }
  | {
      /** 数据维度处理，包括排序，逆序，数据筛选能力 */
      type: 'fields';
      options: IFieldsOptions;
    }
  | {
      /** 使用回调的自定义筛选 */
      type: 'filter';
      options: IFilterOptions;
    }
  | {
      /** 数据展开 */
      type: 'fold';
      options: IFoldOptions;
    };

export interface IFieldsMeta {
  /** TODO: 字段通用format, 暂时先不支持 */
  // format?: (datum: Datum, index: number) => unknown;
  /**
   * 字段别名
   */
  alias?: string;
  /** 字段取值范围 */
  domain?: StringOrNumber[];
  /**
   * 是否使用 domain 锁定统计信息。默认为 false
   * true - 在图例交互场景，也固定domain
   * 当设置为 `onlyFull` 时，仅在初始化的展示完整数据的场景锁定domain，在交互触发的筛选场景不锁定
   */
  lockStatisticsByDomain?: boolean | 'onlyFull';
  /** 连续型 还是 离散型 */
  type?: 'ordinal' | 'linear';
  /** 排序顺序 不设置的话当前维度不进行排序 */
  sortIndex?: number;
  /** 排序时是否反转 默认为 false */
  sortReverse?: boolean;
  /**
   * 排序简易配置
   * 当配置了 sort 时，sortIndex 默认为 0 ，sortReverse 跟随 sort 的值，'desc' 时为 true，'asc' 时为 false
   * 当配置了 sortIndex 和 sortReverser 时，优先级会高于 sort 的默认效果
   * @support since 2.0.0
   */
  sort?: 'desc' | 'asc';
}

export interface SheetParseOptions extends CommonParseOptions {
  /**
   * 特定类型的数据，支持以下类型：
   * - csv: 逗号分隔值（Comma-Separated Values，CSV，有时也称为字符分隔值，因为分隔字符也可以不是逗号），其文件以纯文本形式存储表格数据（数字和文本）。
   * - dsv: 分隔值（Delimiter-Separated Values，DSV，有时也称为字符分隔值，因为分隔字符也可以不是逗号），其文件以纯文本形式存储表格数据（数字和文本）。
   * - tsv: 制表符分隔值（Tab-Separated Values，TSV，有时也称为字符分隔值，因为分隔字符也可以不是逗号），其文件以纯文本形式存储表格数据（数字和文本）。
   */
  type: 'csv' | 'dsv' | 'tsv';
  /**
   * 具体的解析配置
   */
  options?: IDsvParserOptions;
}

export interface CommonParseOptions {
  /**
   * 是否需要对数据进行 clone，默认为 true。
   * 如果考虑性能，你可以将其关闭，但是这会带了一些副作用，即我们会对传入的数据进行修改（不会对原有字段及值修改，只会在原有数据基础上添加一些字段）。
   * @default true
   * @since 1.3.0
   */
  clone?: boolean;
}

export interface IDataValues {
  /**
   * 数据唯一标识
   */
  id?: StringOrNumber;
  /**
   * 数据
   */
  values: Datum[] | string;
  /**
   * 引用的数据索引
   */
  fromDataIndex?: number;
  /**
   * 引用的数据 id
   */
  fromDataId?: StringOrNumber;
  /**
   * 数据 transform 配置
   */
  transforms?: BuildInTransformOptions[];
  /**
   * 数据字段相关配置
   */
  fields?: Record<
    /** 字段key */
    string,
    IFieldsMeta
  >;
  /**
   * 数据解析器配置
   */
  parser?: SheetParseOptions | CommonParseOptions;
}

export type IHierarchyNodeData = {
  value?: number;
  children?: IHierarchyNodeData[];
} & Datum;

export interface IHierarchyDataValues extends Omit<IDataValues, 'values'> {
  values: IHierarchyNodeData;
}

export type IHierarchyData = DataView | IHierarchyDataValues;

/** series */
export interface ISeriesSpec extends IInteractionSpec {
  /** 系列类型 */
  type: SeriesType;

  /** 系列名称 */
  name?: string;

  /** 用户自定义的 series id */
  id?: StringOrNumber;
  /**
   * 系列数据
   * @description 系列可以配置自身的数据，也可以从chart.data中获取数据
   */
  data?: IDataType;
  /**
   * 系列关联的数据索引
   * @default 0
   */
  dataIndex?: number;
  /**
   * 系列关联的数据id
   */
  dataId?: StringOrNumber;
  /**
   * dataKey用于绑定数据与Mark的关系, 该配置在动画中非常重要.
   */
  dataKey?: DataKeyType;

  /**
   * 系列关联的region索引
   * @default 0
   */
  regionIndex?: number;
  /** 系列关联的region id */
  regionId?: StringOrNumber;
  /**
   * 分组字段
   */
  seriesField?: string;
  /**
   * 系列样式
   * @description 仅在图表配置了seriesField时生效
   */
  seriesStyle?: ISeriesStyle;

  /** 是否对数据进行堆叠处理 */
  stack?: boolean;

  /**
   * 堆叠时的分组值
   * stackValue 相等的系列将在一起堆积。没有配置的系列将在一组
   * @since 1.4.0
   */
  stackValue?: StringOrNumber;

  /** 堆叠汇总标签
   * @since 1.3.0
   */
  totalLabel?: ITotalLabelSpec;

  /** 是否对数据进行百分比处理 */
  percent?: boolean;

  /** 是否围绕中心轴偏移轮廓 */
  stackOffsetSilhouette?: boolean;

  /**
   * 非合规数据点连接方式
   * @description null，undefined等非法数据点连接方式。
   * @default 'break'
   * 'break'指在该数据点处断开
   * 'link' 指忽略该点保持连续
   * 'zero' 指该点默认数值为0
   * 'ignore' 指不处理
   */
  invalidType?: IInvalidType;

  /** 系列对应的提示信息设置，优先级高于图表的tooltip配置 */
  tooltip?: ISeriesTooltipSpec;

  /**
   * 是否开启系列动画
   */
  animation?: boolean;
  /**
   * 自动关闭动画的阀值，对应的是单系列data的长度
   * @since 1.2.0
   */
  animationThreshold?: number;

  /**
   * 是否支持3d视角
   */
  support3d?: boolean;
  /**
   * morph 动画配置
   */
  morph?: IMorphSeriesSpec;

  /**
   * 系列的扩展mark，能够获取系列上的数据
   */
  extensionMark?: (IExtensionMarkSpec<Exclude<EnableMarkType, 'group'>> | IExtensionGroupMarkSpec)[];

  /**
   * 今当通过`series`配置的时候，才会生效
   */
  zIndex?: number;

  /**
   * series background
   * 作用是支持系列的图形对系列背景进行 mask，或者切分等效果。不是作为背景图
   * 暂时不开放api，避免出现break change
   */
  // background?: IBackgroundSpec;
}

export type IChartExtendsSeriesSpec<T extends ISeriesSpec> = Omit<T, 'data' | 'morph' | 'stackValue' | 'tooltip'>;

export type AdaptiveSpec<T, K extends keyof any> = {
  [key in Exclude<keyof T, K>]: T[key];
} & { [key in K]: any };

export interface IMarkStateFullSpec<T> extends Record<string, IMarkStateSpec<T> | IMarkStateStyleSpec<T>> {
  /**
   * 正常状态下图元的样式设置
   */
  normal?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /**
   * hover状态下图元的样式设置
   */
  hover?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /**
   * 没有被hover的状态下图元的样式设置
   */
  hover_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /**
   * 选中状态下图元的样式设置
   */
  selected?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
  /**
   * 没有被选中的状态下图元的样式设置
   */
  selected_reverse?: IMarkStateSpec<T> | IMarkStateStyleSpec<T>;
}

/** markSpec */
export type IMarkSpec<T extends ICommonSpec = ICommonSpec> = {
  /**
   * 用户id
   */
  id?: StringOrNumber;
  /**
   * 是否响应交互
   */
  interactive?: boolean;
  // /**
  //  * 是否会被region区域裁减
  //  * @todo 暂未支持
  //  */
  // clip?: boolean;
  /**
   * 与其他mark元素的层级
   */
  zIndex?: number;
  /**
   * mark 层 是否显示配置
   */
  visible?: boolean;
  /** 默认样式设置 */
  style?: ConvertToMarkStyleSpec<T>;
  /** 不同状态下的样式配置 */
  state?: IMarkStateFullSpec<T>;
  /**
   * 状态排序方法，默认状态都是按照添加的顺序处理的，如果有特殊的需求，需要指定状态顺序，可以通过这个方法实现
   * @since 1.9.0
   */
  stateSort?: (stateA: string, stateB: string) => number;

  /*
   * 是否是3d视角的mark
   */
  support3d?: boolean;
  /* customized shape of mark  */
  customShape?: (datum: any[], attrs: any, path: ICustomPath2D) => ICustomPath2D;
} & IMarkProgressiveConfig;

export type IMarkStateFilter =
  | {
      /** 维度筛选 */
      fields: { [key in string]: { type: 'ordinal' | 'linear'; domain: StringOrNumber[] } };
    }
  | {
      /** 筛选数据 */
      datums: Datum[];
      /** 筛选数据 */
      datumKeys: string[];
    }
  | {
      /** 筛选 item */
      items: IGraphic[];
    }
  /** 筛选函数 */
  | ((
      datum: Datum,
      options: {
        mark?: IMark;
        type?: string;
        renderNode?: IGraphic;
      }
    ) => boolean);

export interface IMarkStateSpec<T> {
  /** 筛选器 */
  filter?: IMarkStateFilter;
  /** 状态优先级 */
  level?: number | undefined;
  style: ConvertToMarkStyleSpec<T>;
}

export type IMarkStateStyleSpec<T> = ConvertToMarkStyleSpec<T>;

export interface IMarkStateTheme<T> extends Record<string, T> {
  /**
   * 图元在正常状态下的主题样式设置
   */
  normal?: T;
  /**
   * 图元在 hover 状态下的主题样式设置
   */
  hover?: T;
  /**
   * 图元在 未被hover 状态下的主题样式设置
   */
  hover_reverse?: T;
  /**
   * 图元在 选中状态下的主题样式设置
   */
  selected?: T;
  /**
   * 图元在 未被选中 状态下的主题样式设置
   */
  selected_reverse?: T;
}

export type IMarkTheme<T> = {
  /**
   * mark 层 是否显示配置
   */
  visible?: boolean;
  /** 默认样式设置 */
  style?: T;
  /** 不同状态下的样式配置 */
  state?: IMarkStateTheme<T>;
  /**
   * 可交互的开关
   */
  interactive?: boolean;
};

export interface IPerformanceHook {
  // constructor
  // 创建完成。在使用 vstory 的场景下，图表实例不由业务创建，业务想要获取图表时机非常靠后，因此补充一个钩子
  afterCreateVChart?: (vchart?: IVChart) => void;

  // InitRender
  //   ├── InitializeChart
  //   ├── CompileToVGrammar
  //   ├── ParseView
  //   |  └── ParseExpression
  //   ├── (new View)
  //   |  ├── CreateRuntime
  //   |  └── (view.initialize)
  //   |     └── CreateVRenderStage
  //   └── SrViewEvaluateAsync / SrViewRunAsync
  //      ├── MarkTransform
  //      ├── FacetTransform
  //      ├── CreateVRenderMark
  //      └── VRenderDraw

  // 初始化图表配置
  beforeInitializeChart?: (vchart?: IVChart) => void;
  afterInitializeChart?: (vchart?: IVChart) => void;

  // 编译
  beforeCompileToVGrammar?: (vchart?: IVChart) => void;
  afterCompileToVGrammar?: (vchart?: IVChart) => void;
  // 各个图表模块编译
  beforeRegionCompile?: (vchart?: IVChart) => void;
  afterRegionCompile?: (vchart?: IVChart) => void;
  beforeSeriesCompile?: (vchart?: IVChart) => void;
  afterSeriesCompile?: (vchart?: IVChart) => void;
  beforeComponentCompile?: (vchart?: IVChart) => void;
  afterComponentCompile?: (vchart?: IVChart) => void;

  // resize的时候的钩子
  beforeResizeWithUpdate?: (vchart?: IVChart) => void;
  afterResizeWithUpdate?: (vchart?: IVChart) => void;

  // LayoutWithSceneGraph 二次布局
  beforeLayoutWithSceneGraph?: (vchart?: IVChart) => void;
  afterLayoutWithSceneGraph?: (vchart?: IVChart) => void;

  // VGrammar 解析spec
  beforeParseView?: (vchart?: IVChart) => void;
  afterParseView?: (vchart?: IVChart) => void;

  // 初始化runtime
  beforeCreateRuntime?: (vchart?: IVChart) => void;
  afterCreateRuntime?: (vchart?: IVChart) => void;

  // VGrammar EvaluateAsync 时间
  beforeSrViewEvaluateAsync?: (vchart?: IVChart) => void;
  afterSrViewEvaluateAsync?: (vchart?: IVChart) => void;

  // VGrammar RunAsync 时间
  beforeSrViewRunAsync?: (vchart?: IVChart) => void;
  afterSrViewRunAsync?: (vchart?: IVChart) => void;

  // transform测量
  beforeTransform?: (name: string, vchart?: IVChart) => void;
  afterTransform?: (name: string, vchart?: IVChart) => void;

  // Create VRender Stage 时间
  beforeCreateVRenderStage?: (vchart?: IVChart) => void;
  afterCreateVRenderStage?: (vchart?: IVChart) => void;

  // Create VRender Mark 时间
  beforeCreateVRenderMark?: (vchart?: IVChart) => void;
  afterCreateVRenderMark?: (vchart?: IVChart) => void;

  // VGrammar 创建元素完成，vrender 绘图之前
  beforeDoRender?: (vchart?: IVChart) => void;

  // VRender Draw 时间
  beforeVRenderDraw?: (vchart?: IVChart) => void;
  afterVRenderDraw?: (vchart?: IVChart) => void;

  // 词云
  afterWordcloudShapeDraw?: (vchart?: IVChart) => void;
}

export type IBuildinMarkSpec = {
  group: IGroupMarkSpec;
  symbol: ISymbolMarkSpec;
  rule: IRuleMarkSpec;
  line: ILineMarkSpec;
  text: ITextMarkSpec;
  rect: IRectMarkSpec;
  image: IImageMarkSpec;
  path: IPathMarkSpec;
  area: IAreaMarkSpec;
  arc: IArcMarkSpec;
  polygon: IPolygonMarkSpec;
  boxPlot: IBoxPlotMarkSpec;
  linkPath: ILinkPathMarkSpec;
  ripple: IRippleMarkSpec;
};

export type EnableMarkType = keyof IBuildinMarkSpec;
export interface ICustomMarkSpec<T extends EnableMarkType>
  extends IModelSpec,
    IMarkSpec<IBuildinMarkSpec[T]>,
    IAnimationSpec<string, string> {
  type: T;
  /**
   * mark对应的名称，主要用于事件过滤如： { markName: 'yourName' }
   * @since 1.12.5
   */
  name?: string;
  /**
   * 关联的数据索引
   * @default 与系列使用同一份数据
   */
  dataIndex?: number;
  /**
   * dataKey用于绑定数据与Mark的关系
   * 如果数据和系列数据一致，可以不配置，默认会读取系列中的配置
   *
   * @support since 1.9.5
   */
  dataKey?: string | ((datum: any) => string);
  /**
   * 关联的数据id
   */
  dataId?: StringOrNumber;
  /**
   * specify the component type
   * @support since 1.9.0
   */
  componentType?: string;
  /**
   * enable animation of custom-mark or not
   * @since 1.11.0
   */
  animation?: boolean;
  /**
   * 指定 parent Id
   * @since 1.13.0
   */
  parent?: string;
}
export interface ICustomMarkGroupSpec extends ICustomMarkSpec<MarkTypeEnum.group> {
  children?: ICustomMarkSpec<EnableMarkType>[];
}

export interface IExtensionMarkSpec<T extends Exclude<EnableMarkType, 'group'>> extends ICustomMarkSpec<T> {
  /**
   * 关联的数据索引
   * @default 与系列使用同一份数据
   */
  dataIndex?: number;
  /**
   * dataKey用于绑定数据与Mark的关系
   * 如果数据和系列数据一致，可以不配置，默认会读取系列中的配置
   *
   * @support since 1.9.5
   */
  dataKey?: string | ((datum: any) => string);
  /**
   * 关联的数据id
   */
  dataId?: StringOrNumber;
  /**
   * specify the component type
   * @support since 1.9.0
   */
  componentType?: string;
}

export interface IExtensionGroupMarkSpec extends ICustomMarkSpec<MarkTypeEnum.group> {
  /**
   * 支持子节点
   */
  children?: ICustomMarkSpec<EnableMarkType>[];
}

/** 纯文本类型的 formatMethod */
export type ITextFormatMethod<T extends any[]> = (
  ...args: T
) => ITextMarkSpec['text'] | { type: 'text'; text: ITextMarkSpec['text'] };

export type IRichTextFormatMethod<T extends any[]> = (...args: T) =>
  | {
      /**
       * 设置文本类型为富文本
       */
      type: 'rich';
      /**
       * 当文本类型为富文本的时候，设置文本的内容
       */
      text: IRichTextCharacter[];
    }
  | IRichTextCharacter[];

/**
 * 常规 text.formatMethod 支持返回文字字符串，或统一的对象配置
 * （这里特指由 vgrammar 代理的 text 图元）
 */
export type IFormatMethod<T extends any[]> = (
  ...args: T
) => ReturnType<ITextFormatMethod<T>> | ReturnType<IRichTextFormatMethod<T>>;
