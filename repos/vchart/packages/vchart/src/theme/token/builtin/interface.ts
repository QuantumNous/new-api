import type { TokenMap } from '../interface';

export type BuiltinTokenMap = TokenMap & {
  /** 默认字体 */
  fontFamily: string;
  /** 默认字号 */
  fontSize: number;

  /** 1级字阶字号，用于：环形图中间数值 / 展示型数值 */
  l1FontSize: number;
  /** 1级字阶行高 */
  l1LineHeight: number | string;

  /** 2级字阶字号，用于：展示型文字 / 指标卡数值 */
  l2FontSize: number;
  /** 2级字阶行高 */
  l2LineHeight: number | string;

  /** 3级字阶字号，用于：图表标题 */
  l3FontSize: number;
  /** 3级字阶行高 */
  l3LineHeight: number | string;

  /** 4级字阶字号，用于：数据标签、tooltip */
  l4FontSize: number;
  /** 4级字阶行高 */
  l4LineHeight: number | string;

  /** 5级字阶字号，用于：坐标轴标题、轴标签、图例文字 */
  l5FontSize: number;
  /** 5级字阶行高 */
  l5LineHeight: number | string;

  /** 6级字阶字号，用于：地图标签 */
  l6FontSize: number;
  /** 6级字阶行高 */
  l6LineHeight: number | string;
};
