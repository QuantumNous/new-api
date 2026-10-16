import type { ITextMeasureOption, ITextSize } from '@visactor/vutils';
// eslint-disable-next-line no-duplicate-imports
import type { TextMeasure } from '@visactor/vutils';
import { initTextMeasure as initTextMeasureFunc } from '@visactor/vrender-components/util/text';
import type { ITextGraphicAttribute } from '@visactor/vrender-core';
import { token } from '../theme/token';

export const initTextMeasure = (
  textSpec?: Partial<ITextGraphicAttribute>,
  option?: Partial<ITextMeasureOption>,
  useNaiveCanvas?: boolean
): TextMeasure<ITextGraphicAttribute> => {
  return initTextMeasureFunc(textSpec, option, useNaiveCanvas, {
    fontFamily: token.fontFamily,
    fontSize: token.fontSize
  });
};

export const measureText = (
  text: string,
  textSpec?: Partial<ITextGraphicAttribute>,
  option?: Partial<ITextMeasureOption>,
  useNaiveCanvas?: boolean
): ITextSize => {
  return initTextMeasure(textSpec, option, useNaiveCanvas).measure(text);
};
