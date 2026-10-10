import type { IMosaicSeriesTheme } from '../../../../series/mosaic/interface';

export const mosaic: IMosaicSeriesTheme = {
  label: {
    visible: false,
    position: 'center',
    style: {
      lineWidth: 2,
      stroke: { type: 'palette', key: 'backgroundColor' }
    }
  },

  bar: {
    style: {
      lineWidth: 1,
      stroke: { type: 'palette', key: 'backgroundColor' }
    }
  }
};
