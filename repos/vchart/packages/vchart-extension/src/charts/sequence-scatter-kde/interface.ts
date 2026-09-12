import type { IPlayerSpec } from '@visactor/vchart';
import type { Datum } from '@visactor/vchart/src/typings/common';
import type { ITextGraphicAttribute } from '@visactor/vchart';

type IterationData = Datum[];
type ISequenceScatterKDEData = {
  /**
   * key: 迭代信息
   * value: 每个迭代的数据
   */
  [Iteration: string]: IterationData;

  // TODO: 支持边的绘制
  // [Iteration: string]: {
  //   /**
  //    * 节点数据
  //    */
  //   nodes: IterationNodesData;
  //   /**
  //    * 边数据
  //    */
  //   edges: IterationEdgesData;
  // };
};

export interface ISequenceScatterKDESpec {
  /**
   * 图表类型
   */
  type: 'sequenceScatterKDE';
  /**
   * 数据
   */
  data: ISequenceScatterKDEData;
  /**
   * x轴字段
   */
  xField: string;
  /**
   * y轴字段
   */
  yField: string;
  /**
   * 播放器配置
   */
  player: Omit<IPlayerSpec, 'specs'>;
  /**
   * 文字标记（标记当前处于第几个迭代）
   */
  infoLabel: {
    visible: boolean;
    style: ITextGraphicAttribute;
  };
  /**
   * 背景数据
   */
  backgroundColors: {
    [Iteration: string]: any;
  };
  /**
   * 宽度
   */
  width: number;
  /**
   * 高度
   */
  height: number;
}

export interface Point {
  x: number;
  y: number;
  label?: string;
}
