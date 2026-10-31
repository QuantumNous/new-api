import type React from 'react';
import type { ICommonChartSpec, IVChartConstructor } from '@visactor/vchart';
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
  registerPieSeries,
  registerAnimate,
  registerReactAttributePlugin,
  registerTooltip,
  registerDomTooltipHandler
} from '@visactor/vchart';
import type { BaseChartProps } from './BaseChart';
import { createChart } from './BaseChart';

export interface CommonChartProps
  extends Omit<BaseChartProps, 'spec' | 'container' | 'type' | 'data'>,
    Omit<Partial<ICommonChartSpec>, 'type'> {}

export const CommonChart = createChart<React.PropsWithChildren<CommonChartProps> & { type?: 'common' }>(
  'CommonChart',
  {
    type: 'common',
    vchartConstructor: VChart as IVChartConstructor
  },
  [
    registerAnimate,
    registerReactAttributePlugin,
    registerTooltip,
    registerDomTooltipHandler,
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
