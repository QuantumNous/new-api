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
    },
    conversionArrow: {
      // Defaults intentionally mirror the original hardcoded constants (non-breaking); they are
      // only surfaced to the theme layer so they can be overridden.
      // To adapt to dark themes, override them in a custom theme, e.g. { type: 'palette', key: 'axisDomainColor' }.
      line: {
        style: {
          stroke: 'black'
        }
      },
      symbol: {
        style: {
          fill: 'black'
        }
      },
      text: {
        style: {
          fontSize: 12,
          fill: '#606773'
        }
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
