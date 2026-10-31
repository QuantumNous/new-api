import type { IVChartConstructor, ICommonChartSpec } from '@visactor/vchart';
import {
  VChart,
  registerCommonChart,
  registerCartesianLinearAxis,
  registerCartesianBandAxis,
  registerCartesianTimeAxis, // 非必选
  registerCartesianLogAxis, // 非必选
  registerCartesianCrossHair,
  registerLabel,
  registerTotalLabel,
  registerAreaSeries,
  registerBarSeries,
  registerLineSeries,
  registerScatterSeries,
  registerPieSeries
} from '@visactor/vchart';
import { createChart } from './generate-charts';

export const CommonChart = createChart<ICommonChartSpec>(
  'CommonChart',
  {
    chartConstructor: VChart as IVChartConstructor
  },
  [
    registerCommonChart,
    registerCartesianLinearAxis,
    registerCartesianBandAxis,
    registerCartesianTimeAxis, // 非必选
    registerCartesianLogAxis, // 非必选
    registerCartesianCrossHair,

    registerLabel,
    registerTotalLabel,

    registerAreaSeries,
    registerBarSeries,
    registerLineSeries,
    registerScatterSeries,
    registerPieSeries
  ]
);
