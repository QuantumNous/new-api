import { CSSProperties } from 'react';
import { IOptions } from './IOptions';
import { IVChart, ISpec, IVChartConstructor } from './IVChart';
import { IEvent } from './IEvent';
import { VChartEnvType } from './VChartEnvType';

interface IChartProps<SpecType = ISpec> {
  /**
   * 图表构造函数，必须
   */
  chartConstructor: IVChartConstructor;
  /**
   * 图表 id, 必确唯一
   */
  canvasId: string;
  /**
   * VChart 图表配置项
   */
  spec: SpecType;
  /**
   * 图表容器样式
   */
  style?: CSSProperties;
  /**
   * 初始化 VChart 实例传入的额外配置项，同 VChart 实例化配置项
   */
  options?: IOptions;
  /**
   * 事件绑定配置
   */
  events?: IEvent[];
  /**
   * 图表渲染完毕后触发的回调
   * @param chart
   * @returns
   */
  onChartReady?: (chart: IVChart) => void;
  /**
   * 图表初始化完后触发的回调
   * @param chart
   * @returns
   */
  onChartInit?: (chart: IVChart) => void;
  /**
   * 图表更新完毕后触发的回调
   * @param chart
   * @returns
   */
  onChartUpdate?: (chart: IVChart) => void;
}

interface IVChartProps<SpecType = ISpec> extends IChartProps<SpecType> {
  /**
   * 配置环境。如果没有声明，则会通过 `Taro.getEnv()` 自动获取。
   * - `tt` 字节小程序。
   * - `lark` 飞书小程序。
   * - `weapp` 微信小程序
   * - `h5` 浏览器环境, 与`web`等价。
   * - `web` 浏览器环境, 与`h5`等价。
   */
  type?: VChartEnvType;
}

export { IChartProps, IVChartProps };
