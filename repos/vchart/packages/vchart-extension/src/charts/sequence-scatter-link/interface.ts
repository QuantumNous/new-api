import type { IPlayerSpec } from '@visactor/vchart';
import type { ITextGraphicAttribute } from '@visactor/vchart';

/**
 * 原始数据，包括坐标、邻居、预测结果
 */
export type OriginalData = {
  [key: string]: {
    projection: number[][];
    intra_similarity?: number[][];
    inter_similarity?: number[][];
    prediction?: number[];
    confidence?: number[];
  };
};

/**
 * 训练信息，包括标签、标签颜色、标签文本
 */
export type TrainingInfo = {
  label_text: string[];
  label_color: number[][];
  label_index: number[];
};

/**
 * 轮次点数据
 */
export type IterationNodesData = {
  id: number; // unique identification of a point
  x: number;
  y: number;
  label: string;
  prediction: string;
  confidence: number;
}[];

/**
 * 轮次边数据
 */
export type IterationEdgesData = {
  id: number; // unique identification of an edge
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  type: string;
  color: string;
}[];

/**
 * 边的端点，一条边数据构造两个端点，edgeId相同的端点之间将绘制一条线段
 */
export type Endpoint = {
  edgeId: number; // id of the edge that the endpoint belongs to
  x: number;
  y: number;
  type: string;
  color: string;
};

export type ISequenceScatterLinkData = {
  /**
   * key: 迭代信息
   * value: 每个迭代的数据
   */
  [Iteration: string]: {
    /**
     * 节点数据
     */
    nodes: IterationNodesData;
    /**
     * 边数据
     */
    edges: IterationEdgesData;
  };
};

export interface ISequenceScatterLinkSpec {
  /**
   * 图表类型
   */
  type: 'sequenceScatterLink';
  /**
   * 任务类型
   */
  taskType: string;
  /**
   * 数据
   */
  data: ISequenceScatterLinkData;
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
   * 画布范围
   */
  scope: [number, number, number, number];
}
