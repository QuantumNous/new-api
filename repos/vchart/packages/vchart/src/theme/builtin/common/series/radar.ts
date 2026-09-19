import type { IRadarSeriesTheme } from '../../../../series/radar/interface';

export const radar: IRadarSeriesTheme = {
  label: {
    visible: false,
    offset: 5,
    style: {
      lineWidth: 2,
      stroke: { type: 'palette', key: 'backgroundColor' }
    }
  },
  point: {
    style: {
      symbolType: 'circle'
    }
  }
};
