import type { IGaugeSeriesTheme } from '../../../../series/gauge';

export const gauge: IGaugeSeriesTheme = {
  outerRadius: 0.8,
  innerRadius: 0.6,
  padAngle: 1.146,
  segment: {
    style: {
      fillOpacity: 1
    }
  },
  tickMask: {
    visible: false,
    angle: 3,
    offsetAngle: 0,
    forceAlign: true
  }
};
