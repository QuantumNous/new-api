import type { IInitOption } from '@visactor/vchart';
// eslint-disable-next-line no-duplicate-imports
import type VChart from '@visactor/vchart';
import type { IDomActorConfig } from '../dom/interface';

export interface IVChartActorConfig extends IDomActorConfig {
  defaultSpec?: any;
  initOption?: Partial<IInitOption>;
}

export interface IVChartActorAvatar {
  dom: HTMLDivElement;
  vchart: VChart;
}
