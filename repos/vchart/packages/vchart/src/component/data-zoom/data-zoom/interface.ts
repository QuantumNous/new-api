import type { IMarkSpec } from '../../../typings/spec';
import type {
  IAreaMarkSpec,
  ILineMarkSpec,
  IRectMarkSpec,
  ISymbolMarkSpec,
  ITextMarkSpec
} from '../../../typings/visual';
import type { IComponentSpec } from '../../base/interface';
import type { ComponentThemeWithDirection, IComponent } from '../../interface';
import type { IFilterMode, IDataFilterComponent, IDataFilterComponentSpec } from '../interface';

export type IDataZoom = IComponent & IDataFilterComponent;

// TODO: 开放的状态样式配置较少，暂时不使用markSpec方式配置
export interface IDataZoomStyle {
  /**
   * 是否显示startText和endText
   * @default 'auto' 鼠标hover在选中区域时才显示startText和endText
   */
  showDetail?: 'auto' | boolean;
  /**
   * 中间手柄样式
   */
  middleHandler?: {
    /**
     * 中间手柄是否可见
     */
    visible?: boolean;
    /**
     * 中间手柄的中点图标
     */
    icon?: ISymbolMarkSpec;
    /**
     * 中间手柄的背景矩形
     */
    background?: {
      /**
       * 中间手柄背景矩形的尺寸（当缩略轴为横向时，该尺寸代表高度；同理，当缩略轴为纵向时，该尺寸代表宽度）。
       */
      size?: number;
    } & IRectMarkSpec;
  };
  /**
   * 缩略轴的背景矩形
   */
  background?: {
    /**
     * 缩略轴背景矩形的尺寸（当缩略轴为横向时，该尺寸代表高度；同理，当缩略轴为纵向时，该尺寸代表宽度）
     */
    size?: number;
  } & IRectMarkSpec;
  /**
   * 缩略轴的起点手柄
   */
  startHandler?: ISymbolMarkSpec;
  /**
   * 缩略轴的终点手柄
   */
  endHandler?: ISymbolMarkSpec;
  /**
   * 起点文字样式配置
   */
  startText?: {
    /**
     * 起点文字外边距配置
     */
    padding?: number;
  } & ITextMarkSpec;
  /**
   * 终点文字样式配置
   */
  endText?: {
    /**
     * 终点文字外边距配置
     */
    padding?: number;
  } & ITextMarkSpec;
  /**
   * 缩略轴的拖拽轨迹图元
   */
  dragMask?: IRectMarkSpec;
  /**
   * 缩略轴的选中部分对应的矩形样式配置
   */
  selectedBackground?: IRectMarkSpec;
  /**
   * 缩略轴的预览图表
   */
  backgroundChart?: {
    /**
     * 缩略轴的预览图表，line 样式配置
     */
    line?: ILineMarkSpec;
    /**
     * 缩略轴的预览图表，area 样式配置
     */
    area?: IAreaMarkSpec;
  };
  /**
   * 缩略轴的选中部分预览图表样式配置
   */
  selectedBackgroundChart?: {
    /**
     * 缩略轴的选中部分，line 样式配置
     */
    line?: ILineMarkSpec;
    /**
     * 缩略轴的选中部分，area 样式配置
     */
    area?: IAreaMarkSpec;
  };
}

/** spec */
export interface IDataZoomSpec extends IDataZoomStyle, IDataFilterComponentSpec {
  /**
   * 是否展示背景图
   * @since 1.11.3
   */
  showBackgroundChart?: boolean;
  /**
   * 数据过滤模式
   * 'filter' 为过滤数据从而达到缩放轴的效果, 'axis'为直接缩放轴, 不过滤数据
   * 具体效果可参考: https://www.visactor.io/vchart/demo/sequence-chart/social-media-event?keyword=dataZoom
   * @default 'filter' （dataZoom默认数据过滤模式）
   */
  filterMode?: IFilterMode;
  /**
   * 背景趋势线对应的字段
   */
  valueField?: string;
  /**
   * 起始点文字标签format格式配置
   */
  startText?: {
    /**
     * 起点文字外边距配置
     */
    padding?: number;
    /**
     * 起点文字文本样式配置
     */
    style?: ITextMarkSpec;
    /**
     * 起点文字格式化配置，使用回调函数的形式配置。
     */
    formatMethod?: (text: string | number) => string | string[];
    /**
     * 格式化模板
     * @description 可以通过类似 `{value:.2f}%` 的形式对指定数据字段进行格式化
     * @since 1.10.0
     */
    formatter?: string | string[];
  };
  endText?: {
    /**
     * 终点文字外边距配置
     */
    padding?: number;
    /**
     * 终点文字文本样式配置
     */
    style?: ITextMarkSpec;
    /**
     *
     * 终点文字格式化配置, 使用回调函数的形式配置
     */
    formatMethod?: (text: string | number) => string | string[];
    /**
     * 格式化模板
     * @description 可以通过类似 `{value:.2f}%` 的形式对指定数据字段进行格式化
     * @since 1.10.0
     */
    formatter?: string | string[];
  };
  /**
   * 是否开启框选, 如果不开启则支持selectedBackground拖拽（框选和拖拽两者互斥）
   * @default false
   */
  brushSelect?: boolean;
  /**
   * 是否忽略轴上配置的固定 bandSize
   * 如果置为 true，则 datazoom 可以任意改变轴的 bandSize。
   * 但如果轴上配置了 bandSize 范围，则第一次渲染会保持 bandSize 在配置范围内。
   * 该配置仅在 auto 设为 true 时生效。
   * @since 1.7.0
   */
  ignoreBandSize?: boolean;

  /**
   * 背景图表节点压缩率, 如果不配置则默认将节点限制在10000个
   * @since 1.10.0
   */
  tolerance?: number;
}

export type IDataZoomCommonTheme = IComponentSpec &
  IDataZoomStyle & {
    /** 显示的位置 */
    orient?: IDataZoomSpec['orient'];
    /** 组件宽度 */
    width?: IDataZoomSpec['width'];
    /** 组件高度 */
    height?: IDataZoomSpec['height'];
    /**
     * 是否开启框选, 如果不开启则支持selectedBackground拖拽（框选和拖拽两者互斥）
     * @default false
     */
    brushSelect?: boolean;
  };

export type IDataZoomTheme = ComponentThemeWithDirection<IDataZoomCommonTheme>;
