import type { IMarkAreaTheme } from '../../../../component/marker/mark-area/interface';
import { getCommonLabelTheme } from './mark';

export const markArea: IMarkAreaTheme = {
  area: {
    style: {
      fill: { type: 'palette', key: 'axisDomainColor', a: 0.25 }
    }
  },
  label: getCommonLabelTheme()
};
