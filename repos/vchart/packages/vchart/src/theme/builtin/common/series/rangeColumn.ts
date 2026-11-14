import type { IRangeColumnSeriesTheme } from '../../../../series/range-column/interface';
// eslint-disable-next-line no-duplicate-imports
import { minMaxPositionEnum } from '../../../../series/range-column/interface';

export const rangeColumn: IRangeColumnSeriesTheme = {
  label: {
    visible: false,
    offset: 5,
    position: 'inside',
    style: {
      lineWidth: 2,
      fill: { type: 'palette', key: 'axisMarkerFontColor' }
    },
    minLabel: {
      position: minMaxPositionEnum.end
    },
    maxLabel: {
      position: minMaxPositionEnum.start
    }
  }
};
