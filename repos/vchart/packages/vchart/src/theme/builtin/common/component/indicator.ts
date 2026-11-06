import type { IIndicatorTheme } from '../../../../component/indicator/interface';

const getTextStyle = (fontSizeKey: string, fillKey: string) => {
  return {
    fontSize: { type: 'token', key: fontSizeKey },
    fill: { type: 'palette', key: fillKey },
    fontWeight: 'normal',
    fillOpacity: 1,
    textBaseline: 'top',
    textAlign: 'center'
  };
};

export const indicator: IIndicatorTheme = {
  title: {
    visible: true,
    autoLimit: false,
    autoFit: false,
    style: getTextStyle('l1FontSize', 'primaryFontColor')
  },
  content: {
    visible: true,
    style: getTextStyle('l2FontSize', 'tertiaryFontColor')
  }
};
