import type { IScrollBarTheme } from '../../../../component/data-zoom';

const getSlider = () => {
  return {
    style: {
      fill: { type: 'palette', key: 'scrollBarSliderColor' }
    }
  };
};

export const scrollBar: IScrollBarTheme = {
  horizontal: {
    height: 10,
    slider: getSlider()
  },
  vertical: {
    width: 10,
    slider: getSlider()
  }
};
