import type { IRectMarkSpec, ITextMarkSpec } from '../../typings';
import type { IHierarchyData, IMarkSpec, IMarkTheme, ISeriesSpec } from '../../typings/spec';
import type { TreemapOptions } from '@visactor/vlayouts';
import type { ICartesianSeriesTheme } from '../cartesian/interface';
import type { IAnimationSpec } from '../../animation/spec';
import type { SeriesMarkNameEnum } from '../interface/type';
import type { ILabelSpec } from '../../component/label/interface';

export type TreemapMark = 'leaf' | 'nonLeaf';

export type TreemapAppearPreset = 'growIn' | 'fadeIn';

export interface ITreemapSeriesSpec
  extends Omit<ISeriesSpec, 'data'>,
    IAnimationSpec<TreemapMark, TreemapAppearPreset> {
  type: 'treemap';
  /**
   * 文本字段
   */
  categoryField: string;
  /**
   * 权重字段
   */
  valueField: string;
  /**
   * 数据
   */
  data: IHierarchyData;
  /**
   * 矩形分割比例
   * @default (1 + Math.sqrt(5)) / 2
   */
  aspectRatio?: number;

  /**
   * 矩形分割算法
   * @default 'binary'
   * @description
   * 'binary':    递归地将指定的节点分割成一个近似平衡的二叉树，对宽的矩形选择水平分割，对高的矩形选择垂直分割。
   *
   * 'dice':      根据指定节点的每个子节点的值水平划分由x0, y0, x1, y1指定的矩形区域。子节点按顺序定位，从给定矩形
   *              的左边缘（x0）开始。如果子节点的值之和小于指定节点的值（即，如果指定节点有一个非零的内部值），剩余的空位将被
   *              定位在给定矩形的右边缘（x1）。
   *
   * 'slice':     和'dice'类似，方向为竖直方向分割。
   *
   * 'sliceDice': 节点奇数深度，用'slice'；节点偶数深度，用'dice'。
   *
   * 'squarify':  尽可能按照一个特定长宽比的分割矩形。
   */
  splitType?: TreemapOptions['splitType'];
  /**
   * 节点间距
   * @default 1
   */
  gapWidth?: TreemapOptions['gapWidth'];
  /**
   * 节点内边距
   * @default [5]
   */
  nodePadding?: TreemapOptions['padding'];
  /**
   * 展示的最大层级
   * @description 当节点在层次数据中的深度大于 maxDepth 时，节点将不会被显示
   */
  maxDepth?: TreemapOptions['maxDepth'];
  /**
   * 当区域面积（px * px）小于设定值后，节点将被隐藏
   * @default 10
   */
  minVisibleArea?: TreemapOptions['minVisibleArea'];
  /**
   * 当区域面积（px * px）小于设定值后，节点的子节点将被隐藏
   */
  minChildrenVisibleArea?: TreemapOptions['minChildrenVisibleArea'];
  /**
   * 当区域宽或高（px）小于设定值后，节点的子节点将被隐藏
   */
  minChildrenVisibleSize?: TreemapOptions['minChildrenVisibleSize'];
  /**
   * 是否开启拖拽和缩放
   * @default false
   */
  roam?: boolean;
  /**
   * 下钻配置
   * @default false
   * @description 下钻功能开关
   */
  drill?: boolean;
  /**
   * 钻取字段的field
   * @default DEFAULT_DATA_KEY
   * @description 通过API进行钻取, 需要此配置项.
   */
  drillField?: string;
  /**
   * 叶子节点样式配置
   */
  [SeriesMarkNameEnum.leaf]?: IMarkSpec<IRectMarkSpec>;
  /**
   * 非叶子节点样式配置
   */
  [SeriesMarkNameEnum.nonLeaf]?: IMarkSpec<IRectMarkSpec>;
  /**
   * 叶子节点标签样式配置，默认不显示
   */
  [SeriesMarkNameEnum.label]?: Omit<ILabelSpec, 'position' | 'overlap'>;
  /**
   * 非叶子节点标签样式配置，默认不显示
   */
  [SeriesMarkNameEnum.nonLeafLabel]?: Omit<ILabelSpec, 'position' | 'overlap'> & {
    position?: TreemapOptions['labelPosition'];
    padding?: TreemapOptions['labelPadding'];
  };
}

export interface ITreemapSeriesTheme extends ICartesianSeriesTheme {
  gapWidth?: TreemapOptions['padding'];
  nodePadding?: TreemapOptions['padding'];
  [SeriesMarkNameEnum.leaf]?: Partial<IMarkTheme<IRectMarkSpec>>;
  [SeriesMarkNameEnum.nonLeaf]?: Partial<IMarkTheme<IRectMarkSpec>>;
  [SeriesMarkNameEnum.label]?: Partial<IMarkTheme<ITextMarkSpec>>;
  [SeriesMarkNameEnum.nonLeafLabel]?: Partial<IMarkTheme<ITextMarkSpec> & { padding?: TreemapOptions['labelPadding'] }>;
}
