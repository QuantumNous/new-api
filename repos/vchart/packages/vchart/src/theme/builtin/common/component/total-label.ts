import type { ITotalLabelTheme } from '../../../../component/label';

export const totalLabel: ITotalLabelTheme = {
  visible: false,
  offset: 5,
  overlap: {
    clampForce: true,
    strategy: []
  },
  smartInvert: false,
  animation: false,
  style: {
    fontSize: { type: 'token', key: 'l4FontSize' },
    fill: { type: 'palette', key: 'primaryFontColor' }
  }
};
