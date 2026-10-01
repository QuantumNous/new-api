import type { IBrushTheme } from '../../../../component/brush';

export const brush: IBrushTheme = {
  style: {
    fill: '#B0C8F9',
    fillOpacity: 0.2,
    stroke: '#B0C8F9',
    lineWidth: 2
  },
  brushMode: 'single',
  brushType: 'rect',
  brushMoved: true,
  removeOnClick: true,
  delayType: 'throttle',
  delayTime: 0
};
