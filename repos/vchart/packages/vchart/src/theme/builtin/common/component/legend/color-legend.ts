import type { IColorLegendTheme, IContinuousLegendTheme } from '../../../../../component/legend';
import { DEFAULT_CONTINUOUS_LEGEND_THEME } from './continuous';

const getColorLegendTheme = (horizontal?: boolean): IContinuousLegendTheme => {
  const rail: IContinuousLegendTheme['rail'] = {
    width: 200,
    height: 8,
    style: {
      fill: { type: 'palette', key: 'sliderRailColor' }
    }
  };

  if (horizontal) {
    rail.width = 200;
    rail.height = 8;
  } else {
    rail.width = 8;
    rail.height = 200;
  }

  return {
    ...DEFAULT_CONTINUOUS_LEGEND_THEME,
    rail,
    handler: {
      style: {
        symbolType: 'circle',
        lineWidth: 0,
        outerBorder: {
          lineWidth: 2,
          distance: 0.8,
          stroke: '#ffffff'
        },
        shadowBlur: 12,
        shadowOffsetX: 0,
        shadowOffsetY: 4,
        shadowColor: { type: 'palette', key: 'shadowColor' }
      }
    }
  };
};

export const colorLegend: IColorLegendTheme = {
  horizontal: getColorLegendTheme(true),
  vertical: getColorLegendTheme(false)
};
