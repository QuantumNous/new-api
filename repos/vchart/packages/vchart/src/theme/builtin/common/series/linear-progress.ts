import type { ILinearProgressSeriesTheme } from '../../../../series/progress/linear/interface';

export const linearProgress: ILinearProgressSeriesTheme = {
  bandWidth: 30,
  progress: {
    style: {
      fillOpacity: 1
    }
  },
  track: {
    style: {
      fill: { type: 'palette', key: 'linearProgressTrackColor' },
      fillOpacity: 1
    }
  }
};
