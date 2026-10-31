import type { ICirclePackingSeriesTheme } from '../../../../series/circle-packing/interface';

export const circlePacking: ICirclePackingSeriesTheme = {
  layoutPadding: 5,
  circlePacking: {
    visible: true,
    style: {
      cursor: 'pointer',
      lineWidth: 1,
      stroke: { type: 'palette', key: 'backgroundColor' }
    }
  },
  label: {
    visible: true,
    style: {
      cursor: 'pointer',
      fill: 'black',
      stroke: { type: 'palette', key: 'backgroundColor' },
      lineWidth: 2,
      fontSize: { type: 'token', key: 'l5FontSize' },
      lineHeight: { type: 'token', key: 'l5LineHeight' }
    }
  }
};
