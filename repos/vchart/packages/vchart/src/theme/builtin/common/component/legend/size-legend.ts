import type { IContinuousLegendSpec, ISizeLegendCommonTheme, ISizeLegendTheme } from '../../../../../component/legend';
import { DEFAULT_CONTINUOUS_LEGEND_THEME } from './continuous';

const getSizeLegendTheme = (horizontal?: boolean): ISizeLegendCommonTheme => {
  const rail: IContinuousLegendSpec['rail'] = {
    style: {
      fill: { type: 'palette', key: 'sliderRailColor' }
    }
  };
  if (horizontal) {
    rail.width = 200;
    rail.height = 4;
  } else {
    rail.height = 200;
    rail.width = 4;
  }

  return {
    ...DEFAULT_CONTINUOUS_LEGEND_THEME,
    sizeBackground: {
      fill: { type: 'palette', key: 'dataZoomChartColor' }
    },
    track: {
      style: {
        fill: { type: 'palette', key: 'sliderTrackColor', a: 0.8 }
      }
    },
    rail,
    handler: {
      style: {
        symbolType: 'circle',
        lineWidth: 0,
        outerBorder: {
          lineWidth: 2,
          distance: 0.8,
          stroke: { type: 'palette', key: 'sliderTrackColor' }
        },
        fill: { type: 'palette', key: 'sliderHandleColor' }
        /*
        shadowBlur: 12,
        shadowOffsetX: 0,
        shadowOffsetY: 4,
        shadowColor: { type: 'palette', key: 'shadowColor' }
        */
      }
    }
  };
};

export const sizeLegend: ISizeLegendTheme = {
  horizontal: getSizeLegendTheme(true),
  vertical: getSizeLegendTheme(false)
};
