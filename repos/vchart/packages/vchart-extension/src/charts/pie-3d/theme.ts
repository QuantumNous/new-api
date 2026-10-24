import type { IPie3dSeriesTheme } from './interface';

export const pie3d: IPie3dSeriesTheme = {
  outerRadius: 0.6,
  pie3d: {
    style: {
      height: 10,
      fillOpacity: 1
    }
  },
  label: {
    visible: false,
    interactive: true,
    position: 'outside'
  }
};
