import type { IPoptipTheme } from '../../../../component/poptip/interface';

export const poptip: IPoptipTheme = {
  visible: true,
  position: 'auto',
  padding: 8,
  titleStyle: {
    fontSize: { type: 'token', key: 'l5FontSize' },
    fontWeight: 'bold',
    fill: { type: 'palette', key: 'primaryFontColor' }
  },
  contentStyle: {
    fontSize: { type: 'token', key: 'l5FontSize' },
    fill: { type: 'palette', key: 'primaryFontColor' }
  },
  panel: {
    visible: true,
    fill: { type: 'palette', key: 'popupBackgroundColor' },
    cornerRadius: 3,
    lineWidth: 0,
    shadowBlur: 12,
    shadowOffsetX: 0,
    shadowOffsetY: 4,
    shadowColor: { type: 'palette', key: 'shadowColor' },
    size: 0,
    space: 12
  }
};
