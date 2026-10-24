import type { ITextMeasureOption, ITextSize } from '@visactor/vutils';
import type { TextMeasure } from '@visactor/vutils';
import type { ITextGraphicAttribute } from '@visactor/vrender-core';
export declare const initTextMeasure: (textSpec?: Partial<ITextGraphicAttribute>, option?: Partial<ITextMeasureOption>, useNaiveCanvas?: boolean) => TextMeasure<ITextGraphicAttribute>;
export declare const measureText: (text: string, textSpec?: Partial<ITextGraphicAttribute>, option?: Partial<ITextMeasureOption>, useNaiveCanvas?: boolean) => ITextSize;
