import type { IHeatmapSeriesTheme } from '../../../../series/heatmap/interface';

export const heatmap: IHeatmapSeriesTheme = {
  cell: {
    style: {
      shape: 'rect',
      fillOpacity: 1
    }
  },
  cellBackground: {
    visible: false
  },
  label: {
    style: {
      lineWidth: 2
    }
  }
};
