import type { ICircularProgressSeriesTheme } from '../../../../series/progress/circular/interface';

export const circularProgress: ICircularProgressSeriesTheme = {
  outerRadius: 0.8,
  innerRadius: 0.6,
  progress: {
    style: {
      fillOpacity: 1
    }
  },
  track: {
    style: {
      fillOpacity: 0.2
    }
  },
  tickMask: {
    visible: false,
    angle: 3,
    offsetAngle: 0,
    forceAlign: true
  }
};
