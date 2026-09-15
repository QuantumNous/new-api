import type { IMarkerSymbol } from '../../../../component/marker/interface';
import type { IMarkLineTheme } from '../../../../component/marker/mark-line/interface';
import { getCommonLabelTheme } from './mark';

const getSymbolTheme = (visible?: boolean): IMarkerSymbol => {
  return {
    visible,
    symbolType: 'triangle',
    size: 10,
    style: {
      fill: { type: 'palette', key: 'markLineStrokeColor' },
      stroke: null,
      lineWidth: 0
    }
  };
};

const labelTheme = getCommonLabelTheme();
labelTheme.refY = 5;

export const markLine: IMarkLineTheme = {
  line: {
    style: {
      lineDash: [3, 3],
      stroke: { type: 'palette', key: 'markLineStrokeColor' }
    }
  },
  startSymbol: getSymbolTheme(false),
  endSymbol: getSymbolTheme(true),
  label: labelTheme
};
