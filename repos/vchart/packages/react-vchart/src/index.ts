export * from './charts';
export * from './series';
export * from './components';
export * from './VChart';
export * from './VChartSimple';
export * from './register';
export { VChart as VChartCore } from '@visactor/vchart';

// export the version, since @1.8.3
export const version = __VERSION__;

export type {
  IAreaChartSpec,
  IBarChartSpec,
  IBoxPlotChartSpec,
  ICirclePackingChartSpec,
  ICommonChartSpec,
  IFunnelChartSpec,
  IGaugeChartSpec,
  IHeatmapChartSpec,
  IHistogramChartSpec,
  ILineChartSpec,
  IMapChartSpec,
  IPieChartSpec,
  ICircularProgressChartSpec,
  ILinearProgressChartSpec,
  IRadarChartSpec,
  IRangeColumnChartSpec,
  IRangeAreaChartSpec,
  IRoseChartSpec,
  IScatterChartSpec,
  ISankeyChartSpec,
  ISequenceChartSpec,
  ISunburstChartSpec,
  ITreemapChartSpec,
  IWaterfallChartSpec,
  ICorrelationChartSpec,
  ILiquidChartSpec,
  IWordCloudChartSpec,
  IPolarChartSpec,
  ICartesianChartSpec,
  ITheme,
  IInitOption,
  ISpec,
  IVChart
} from '@visactor/vchart';

export type {
  IBar3dChartSpec,
  IFunnel3dChartSpec,
  IHistogram3dChartSpec,
  IPie3dChartSpec,
  IRangeColumn3dChartSpec,
  IWordCloud3dChartSpec
} from '@visactor/vchart-extension';
