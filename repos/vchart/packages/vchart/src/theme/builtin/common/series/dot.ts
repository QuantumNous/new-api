import type { IDotSeriesTheme } from '../../../../series/dot/interface';

export const dot: IDotSeriesTheme = {
  dot: {
    style: {
      size: 10,
      fillOpacity: 1
    }
  },
  symbol: {
    style: {
      size: 10
    }
  },
  title: {
    style: {
      textAlign: 'left',
      textBaseline: 'middle',
      fontSize: { type: 'token', key: 'l5FontSize' },
      lineHeight: { type: 'token', key: 'l5LineHeight' }
    }
  },
  subTitle: {
    style: {
      textAlign: 'left',
      textBaseline: 'top',
      fontSize: { type: 'token', key: 'l5FontSize' },
      lineHeight: { type: 'token', key: 'l5LineHeight' }
    }
  }
};
