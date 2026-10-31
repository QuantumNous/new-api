import type { IRoseSeriesTheme } from '../../../../series/rose/interface';

export const rose: IRoseSeriesTheme = {
  rose: {
    style: {
      fillOpacity: 1
    }
  },
  label: {
    style: {
      lineWidth: 2,
      stroke: { type: 'palette', key: 'backgroundColor' },
      textAlign: 'center',
      textBaseline: 'middle'
    }
  }
};
