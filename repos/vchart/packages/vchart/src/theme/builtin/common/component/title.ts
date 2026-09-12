import type { ITitleTheme } from '../../../../component/title/interface';

export const title: ITitleTheme = {
  padding: {
    top: 4,
    bottom: 20
  },
  textStyle: {
    fontSize: { type: 'token', key: 'l3FontSize' },
    lineHeight: { type: 'token', key: 'l3LineHeight' },
    fill: { type: 'palette', key: 'primaryFontColor' }
  },
  subtextStyle: {
    fontSize: { type: 'token', key: 'l4FontSize' },
    lineHeight: { type: 'token', key: 'l4LineHeight' },
    fill: { type: 'palette', key: 'tertiaryFontColor' }
  }
};
