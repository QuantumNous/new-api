import type { ISeriesTheme } from '../../../../series/interface';
import { area } from './area';
import { bar } from './bar';
import { circularProgress } from './circular-progress';
import { dot } from './dot';
import { funnel } from './funnel';
import { gauge } from './gauge';
import { gaugePointer } from './gauge-pointer';
import { line } from './line';
import { linearProgress } from './linear-progress';
import { link } from './link';
import { map } from './map';
import { pie } from './pie';
import { radar } from './radar';
import { scatter } from './scatter';
import { waterfall } from './waterfall';
import { wordCloud } from './word-cloud';
import { treemap } from './treemap';
import { sunburst } from './sunburst';
import { rangeColumn } from './rangeColumn';
import { circlePacking } from './circle-packing';
import { heatmap } from './heatmap';
import { sankey } from './sankey';
import { rose } from './rose';
import { boxPlot } from './box-plot';
import { correlation } from './correlation';
import { liquid } from './liquid';
import { venn } from './venn';
import { mosaic } from './mosaic';

export const series: ISeriesTheme = {
  scatter,
  line,
  area,
  bar,
  pie,
  map,
  radar,
  dot,
  link,
  wordCloud,
  funnel,
  linearProgress,
  circularProgress,
  waterfall,
  gauge,
  gaugePointer,
  treemap,
  sunburst,
  rangeColumn,
  circlePacking,
  heatmap,
  sankey,
  rose,
  boxPlot,
  correlation,
  liquid,
  venn,
  mosaic
};
