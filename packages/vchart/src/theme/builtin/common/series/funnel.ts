import type { IFunnelSeriesTheme } from '../../../../series/funnel/interface';

export const getFunnelTheme = (is3d?: boolean): IFunnelSeriesTheme => {
  const res: IFunnelSeriesTheme = {
    label: {
      style: {
        fill: 'white',
        textBaseline: 'middle',
        lineWidth: 2
      }
    },
    outerLabel: {
      style: {
        fontSize: { type: 'token', key: 'l4FontSize' },
        fill: { type: 'palette', key: 'secondaryFontColor' }
      },
      line: {
        style: {
          stroke: { type: 'palette', key: 'axisDomainColor' }
        }
      }
    },
    transformLabel: {
      style: {
        fontSize: { type: 'token', key: 'l4FontSize' },
        fill: { type: 'palette', key: 'secondaryFontColor' },
        textBaseline: 'middle'
      }
    }
  };

  (res as any)[is3d ? 'transform3d' : 'transform'] = {
    style: {
      fill: { type: 'palette', key: 'axisGridColor' }
    }
  };

  return res;
};

export const funnel: IFunnelSeriesTheme = getFunnelTheme();
