import type { IMarkPointTheme } from '../../../../component/marker/mark-point/interface';

export const markPoint: IMarkPointTheme = {
  itemLine: {
    decorativeLine: {
      visible: false
    },
    startSymbol: {
      size: 5,
      visible: true,
      style: {
        fill: { type: 'palette', key: 'markLineStrokeColor' },
        stroke: null,
        lineWidth: 0
      }
    },
    endSymbol: {
      style: {
        fill: { type: 'palette', key: 'markLineStrokeColor' },
        stroke: null,
        lineWidth: 0
      }
    },
    line: {
      style: {
        stroke: { type: 'palette', key: 'markLineStrokeColor' }
      }
    }
  },
  itemContent: {
    offsetY: -50
  }
};
