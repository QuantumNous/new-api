import { PREFIX } from './base';

export const BOX_PLOT_OUTLIER_VALUE_FIELD = `${PREFIX}_BOX_PLOT_OUTLIER_VALUE`;

export enum BOX_PLOT_TOOLTIP_KEYS {
  OUTLIER = 'outlier',
  MAX = 'max',
  MIN = 'min',
  MEDIAN = 'median',
  Q1 = 'q1',
  Q3 = 'q3',
  SERIES_FIELD = 'seriesField'
}
