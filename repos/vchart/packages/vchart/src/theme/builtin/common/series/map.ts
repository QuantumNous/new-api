import type { IMapSeriesTheme } from '../../../../series/map/interface';

export const map: IMapSeriesTheme = {
  defaultFillColor: '#f3f3f3',
  area: {
    style: {
      lineWidth: 0.5,
      strokeOpacity: 1,
      stroke: 'black',
      fillOpacity: 1
    }
  },
  label: {
    interactive: false,
    style: {
      fontSize: { type: 'token', key: 'l6FontSize' },
      lineHeight: { type: 'token', key: 'l6LineHeight' },
      textBaseline: 'middle',
      fill: { type: 'palette', key: 'secondaryFontColor', default: '#89909d' },
      stroke: { type: 'palette', key: 'backgroundColor' }
    }
  }
};
