import type { ICorrelationSeriesTheme } from '../../../../series/correlation/interface';

export const correlation: ICorrelationSeriesTheme = {
  centerLabel: {
    visible: true,
    position: 'center',
    style: {
      fill: '#fff',
      text: ''
    }
  },
  label: {
    visible: true,
    position: 'bottom',
    style: {
      fill: '#000'
    }
  }
};
