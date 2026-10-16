import { IChartInfo } from './interface';
import area from './area';
import bar from './bar';
import column from './column';
import pie from './pie';
import rose from './rose';
import radar from './radar';
import scatter from './scatter';
import heatmap from './heatmap';
import markArea from './mark-area';
import markLine from './mark-line';
import markPoint from './cartesian-mark-point';
import gauge from './gauge';
import funnel from './funnel';

export const charts: IChartInfo[] = [
  area,
  column,
  pie,
  bar,
  rose,
  radar,
  scatter,
  heatmap,
  gauge,
  funnel,
  markArea,
  markLine,
  markPoint
];
