import type { ILineGraphicAttribute, ITextGraphicAttribute } from '@visactor/vchart';

export type IRankingBarData = any[];

export interface IPlayConfig {
  interval?: number; // 单位毫秒
}

export interface IRankingBarSpec extends IPlayConfig {
  type: string;
  data: IRankingBarData;

  timeField: string;
  xField: string;
  yField: string;

  topN?: number;

  bar?: {
    padding?: number;
    cornerRadius?: number;
  };

  color?: Record<string, string>;

  icon?: Record<string, string>;

  iconPosition?: 'bar-end' | 'bar-start' | 'axis';

  iconShape?: 'circle' | 'rect';

  background?: string;

  label?: {
    visible?: boolean;
    style?: ITextGraphicAttribute;
  };

  nameLabel?: ITextGraphicAttribute & {
    visible?: boolean;
    position?: 'bar-end' | 'bar-start';
    style?: ITextGraphicAttribute;
  };

  timeLabel?: {
    visible?: boolean;
    style?: ITextGraphicAttribute;
  };

  xAxis?: {
    label?: ITextGraphicAttribute;
    domainLine?: ILineGraphicAttribute;
    grid?: ILineGraphicAttribute;
  };

  yAxis?: {
    label?: ITextGraphicAttribute;
    domainLine?: ILineGraphicAttribute;
    grid?: ILineGraphicAttribute;
  };
}
