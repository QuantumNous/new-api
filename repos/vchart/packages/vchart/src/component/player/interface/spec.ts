import type { IChartSpec } from '../../../typings/spec';
import type { IPlayerTheme } from './theme';

export interface IPlayerField {
  playerField?: string;
}

export interface IPlayer extends IPlayerTheme {
  /**
   * 播放器类型
   * @default 'continuous'
   */
  type?: PlayerType;

  /**
   * 自动播放
   * @default true
   */
  auto?: boolean;

  /**
   * 循环播放
   * @default false
   */
  loop?: boolean;

  /**
   * 播放间隔
   * @default 1000
   * @description 该配置与totalDuration互斥, 若配置播放间隔, 则会重新计算总时长.
   */
  interval?: number;

  /**
   * 播放总时长
   * @default undefined
   * @description 该配置与interval互斥, 若配置总时长, 则会重新计算播放间隔.
   * ! 感觉这个配置, 不是很有必要.
   */
  totalDuration?: number;

  /**
   * 播放方向
   * @default 'default'
   * @description 离散轴支持三种播放方向, 连续型仅支持'default'.
   */
  direction?: DirectionType;

  /**
   * 交替方向
   * @default false
   * @description 下一次播放时更换方向
   */
  alternate?: boolean;

  /**
   * TODO: 移除此配置, 转移到外层的specsPlayer.
   * 播放器每一项的图表配置
   * @default []
   * @description 每一个spec会merge外层的spec
   */
  specs?: Partial<Omit<IChartSpec, 'player'>>[];
}

export type IPlayerSpec = IPlayer;
/**
 * 播放器类型
 * 连续 | 离散.
 */
export type PlayerType = 'continuous' | 'discrete';

/**
 * 播放方向
 * default 默认的
 * reverse 反方向
 */
export type DirectionType = 'default' | 'reverse';
