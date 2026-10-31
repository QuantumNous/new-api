import type {
  IAreaGraphicAttribute,
  IGroupGraphicAttribute,
  ILineGraphicAttribute,
  ITextGraphicAttribute
} from '@visactor/vrender-core';
import type { Dict, IPointLike, SegmentAttributes } from '@visactor/vchart';

export type BarLinkDatum = {
  /**
   * 用于绘制的面积的坐标点
   */
  areaPoints: [IPointLike, IPointLike];
  /**
   * 用于绘制线的坐标点
   */
  linePoints: [IPointLike, IPointLike];

  /**
   * 唯一标识，如果不声明，则默认使用数据索引
   */
  id?: string;
  color?: string;
  /**
   * 点携带的图形数据
   */
  data: [Dict<any>, Dict<any>];
};

export interface BarLinkAttrs extends IGroupGraphicAttribute {
  data: BarLinkDatum[];
  /**
   * 连接类型
   * 1. 'total' 累计值进行连接
   * 2. 'value' 本身值连接
   */
  linkType?: 'total' | 'value';
  /**
   * 是否填充
   */
  doFill?: boolean;
  linkStyle?: Pick<SegmentAttributes, 'startSymbol' | 'endSymbol' | 'lineStyle'>;
  areaStyle?: IAreaGraphicAttribute;
  /**
   * 用于配置各个线的样式，key 对应线的 id，主要用于连接线的编辑场景
   * 1. 删除：{ visible: false }
   * 2. 样式编辑：{ stroke: 'red' }
   */
  styleMap?: Record<string, ILineGraphicAttribute>;
  label?: {
    visible?: boolean;
    style?: ITextGraphicAttribute;
    formatMethod?: (value: number, percent: number, data: [any, any]) => (string | number) | (string | number)[];
  };
}
